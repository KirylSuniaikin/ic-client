import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ApplePayNotice from "../domains/order/components/ApplePayNotice";
import PizzaPopup from "../domains/menu/components/popups/PizzaPopupContent";
import ComboPopup from "../domains/menu/components/popups/ComboPopupContent";
import { PizzaComboPopup } from "../domains/menu/components/popups/combo/PizzaComboPopup";
import { DetroitComboPopup } from "../domains/menu/components/popups/combo/DetroitComboPopup";
import { UpsellPopup } from "../domains/order/components/UpSellPopup";
import { KioskBranchSelector } from "../domains/kiosk/components/KioskBranchSelector";
import { KioskPhoneEntrySheet } from "../domains/kiosk/components/KioskPhoneEntrySheet";
import { KioskOrderPlacedSheet } from "../domains/kiosk/components/KioskOrderPlacedSheet";
import { writeKioskBranch } from "../domains/kiosk/utils/kioskBranch";
import { BranchPickerDrawer } from "../domains/branch/components/BranchPickerDrawer";
import { BranchSwitchWarningDrawer } from "../domains/branch/components/BranchSwitchWarningDrawer";
import type { UseBranchSwitchResult } from "../domains/branch/hooks/useBranchSwitch";
import { useBranchResolution } from "../domains/branch/hooks/useBranchResolution";
import type { UseKioskCheckoutResult } from "../domains/kiosk/hooks/useKioskCheckout";
import { BaguettePizzaPopup } from "../domains/menu/components/popups/BaguettePizzaPopup";
import CrossSellPopup from "../domains/order/components/CrossSellPopup";
import CartPopup from "../domains/cart/components/CartComponent";
import ClosedPopup from "../domains/schedule/components/ClosedPopup";
import ClientInfoPopup from "../domains/order/components/ClientInfoPopup";
import AdminOrderDetailsPopUp from "../domains/management/orders/components/AdminOrderDetailsPopUp";
import { PickUpReminderPopup } from "../domains/order/components/PickUpReminderPopup";
import OrderConfirmed from "../domains/order/components/OrderConfirmed";
import GenericItemPopupContent from "../domains/menu/components/popups/GenericItemPopupContent";
import ErrorSnackbar from "../shared/components/ErrorSnackbar";
import { UnavailablePopup } from "../domains/menu/components/UnavailablePopup";
import { KeetaFallbackCard } from "../domains/delivery/components/KeetaFallbackCard";
import { useCustomerAuthUi } from "../domains/customer-auth/context/CustomerAuthUiProvider";
import { useDeliveryAvailability } from "../domains/delivery/hooks/useDeliveryAvailability";
import { basketSignature, toDeliveryBasket } from "../domains/delivery/basket";
import { DeliveryCheckoutDrawer } from "../domains/delivery/components/DeliveryCheckoutDrawer";
import { payForDelivery, reportKeetaFallbackChosen } from "../shared/api/delivery";
import { logger } from "../shared/utils/logger";
import { Snackbar } from "@mui/material";
import type {
    CustomerAddress, DeliveryAvailability, DeliveryPaymentMethod, KeetaFallbackEvent,
} from "../domains/delivery/types";
import type { UseCartResult } from "../domains/cart/hooks/useCart";
import type { UseCheckoutResult } from "../domains/order/hooks/useCheckout";
import type { UseApplePayCheckoutResult } from "../domains/order/hooks/useApplePayCheckout";
import type { UseCardCheckoutResult } from "../domains/order/hooks/useCardCheckout";
import CardPaymentDrawer from "../domains/order/components/CardPaymentDrawer";
import { computeSheetTotal } from "../domains/order/utils/applePayRequest";
import type { CartItem, ExtraIngr, Group, MenuItem, Topping } from "../domains/menu/types";
import type { IBranch } from "../domains/management/inventory/types";
import type { WorkingHoursSchedule } from "../shared/api/management";
import { confirmBenefitPayPayment } from "../shared/api/public";
import { BenefitPayDialog } from "../domains/payment/components/BenefitPayDialog";

interface HomePageModalsProps {
    cart: UseCartResult;
    checkout: UseCheckoutResult;
    applePay?: UseApplePayCheckoutResult;
    cardPayment?: UseCardCheckoutResult;
    menuData: MenuItem[];
    toppings: Topping[];
    extraIngredients: ExtraIngr[];
    availableBranches: IBranch[];
    isSDoughAvailable: boolean;
    phone: string;
    username: string;
    branchSelector: boolean | null;
    setBranchSelector: Dispatch<SetStateAction<boolean | null>>;
    kiosk: UseKioskCheckoutResult;
    refreshMenu: () => Promise<void>;
    pizzas: Group[];
    brickPizzas: Group[];
    beverages: Group[];
    sauces: Group[];
    isAdmin: boolean;
    isKiosk: boolean;
    adminBranchId: string | null;
    workingHours?: WorkingHoursSchedule | null;
    customerBranchGateOpen: boolean;
    onCustomerBranchSelect: (branch: IBranch) => void;
    branchSwitch: UseBranchSwitchResult;
    /** Owned by HomePage, not here: the fixed cart pill has to know this sheet is up, and it
     * cannot see state that lives in this component. */
    keetaOpen: boolean;
    setKeetaOpen: Dispatch<SetStateAction<boolean>>;
}

export default function HomePageModals({
    cart, checkout, applePay, cardPayment, menuData, toppings, extraIngredients, availableBranches,
    isSDoughAvailable, phone, username,
    branchSelector, setBranchSelector, kiosk, refreshMenu,
    pizzas, brickPizzas, beverages, sauces, isAdmin, isKiosk, adminBranchId, workingHours,
    customerBranchGateOpen, onCustomerBranchSelect, branchSwitch, keetaOpen, setKeetaOpen,
}: HomePageModalsProps): JSX.Element {
    const { t } = useTranslation("checkout");

    // Local const so the null-check below narrows inside PickUpReminderPopup's onClick
    // (narrowing a property access would not survive into the callback).
    const pendingOrder = checkout.pendingOrder;

    // The branch a pickup order is filed against: useCheckout sends chosenBranchId, so the cart
    // names that same branch. Looked up in the fresh branch list rather than the stored copy, which
    // was frozen at selection time and can predate fields like the address or the Arabic name.
    const { chosenBranchId } = useBranchResolution();
    const pickupBranch = availableBranches.find(b => String(b.id) === chosenBranchId) ?? null;

    const deliveryAvailability = useDeliveryAvailability();
    // The pickup path seeds the homepage island from useCheckout the moment an order is created;
    // delivery creates its order over here instead, so it has to do the same or the widget stays
    // empty until the customer reloads the page.
    const { refreshActiveOrder } = useCustomerAuthUi();
    const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);
    // Synchronous re-entry guard for the delivery confirm, the same shape as useCheckout's
    // `submittingRef`. The pickup path is guarded inside `executeOrderCreation`, but a delivery
    // order never enters it, so that guard is not on this branch: `pendingDeliveryOrder` — which
    // is what keeps the confirm sheet open — is only cleared AFTER `payForDelivery` resolves, so
    // a second press in the meantime starts a second charge. React state commits asynchronously;
    // a ref updates in the same tick, so the second press short-circuits.
    //
    // In production this is currently absorbed by the backend's idempotency key and by the sheet
    // closing on the first press. Neither of those is this screen's to keep, which is why the
    // guard belongs here rather than being left to them.
    const deliverySubmittingRef = useRef(false);

    const deliveryBasket = useMemo(() => toDeliveryBasket(cart.cartItems), [cart.cartItems]);
    const basketKey = basketSignature(deliveryBasket);
    const gateCallRef = useRef(0);
    const gatedBasketKeyRef = useRef<string | null>(null);

    /**
     * Which refusal opened the Keeta card: the cart check or the address step, and the gate's own
     * reason for it. A ref, not state — it is only read when the button is pressed, and the card's
     * displayed `reason` deliberately keeps coming from the cart check as it did before.
     */
    const keetaContextRef = useRef<KeetaFallbackEvent | null>(null);

    function handleKeetaChosen(): void {
        const context = keetaContextRef.current;
        if (context === null) {
            logger.warn("Keeta chosen with no refusal on record; not counted");
            return;
        }
        // Fire-and-forget: the card opens Keeta in this same click and must not wait on us.
        void reportKeetaFallbackChosen(context);
    }

    /**
     * §1.2 step 1 — the early gate. Runs the moment the customer picks Delivery, before they
     * invest any effort in an address, so a branch with no free courier is caught up front.
     *
     * No pin exists yet, so this is only the branch-level courier question; the radius is
     * re-checked on Place order (§1.2 step 2). Selecting Pick Up never calls the gate.
     *
     * On refusal the toggle stays on Pick Up rather than sitting on a Delivery the customer
     * cannot have — leaving it selected would let them walk into checkout and be refused again.
     */
    /**
     * §1.7: settle, then create. `useCheckout` stops its funnel at the built order for Delivery
     * (see finalizeOrder) rather than creating it, so everything the order needs — items,
     * totals, identity, attribution, idempotency key — is already on `pendingDeliveryOrder`.
     * Only the two facts this screen owns are layered on top.
     */
    async function handleDeliveryConfirm(
        address: CustomerAddress,
        availability: DeliveryAvailability,
        method: DeliveryPaymentMethod
    ): Promise<void> {
        const pending = checkout.pendingDeliveryOrder;
        if (pending === null) return;
        if (deliverySubmittingRef.current) return;
        deliverySubmittingRef.current = true;
        try {
            const result = await payForDelivery({
                method,
                addressId: address.id,
                order: {
                    ...pending,
                    payment_type: method,
                    // The gate resolved the nearest branch for this pin (§1.4.5); the branch the
                    // cart defaulted to would file the order at the wrong kitchen.
                    branchId: availability.branchId ?? pending.branchId,
                },
            });

            checkout.setPendingDeliveryOrder(null);
            cart.setCartItems([]);
            checkout.setOrderType("Pick Up");

            // A real provider hands back a hosted-checkout page, and the order it just created is
            // still `Pending Payment`. Confirming here would tell the customer they had paid for
            // an order nothing will ever settle — and they would never reach the payment page at
            // all. The stub has no page to send them to, so it keeps the confirmation path.
            if (!result.stub && result.redirectUrl) {
                window.location.assign(result.redirectUrl);
                return;
            }

            if (result.stub) {
                // Never let a stubbed order read as a real charge.
                setDeliveryNotice(t("delivery.stubNotice"));
            }
            refreshActiveOrder();
            checkout.setShowOrderConfirmed(true);
        } catch (error) {
            logger.error("Delivery checkout failed:", error);
            setDeliveryNotice(error instanceof Error ? error.message : String(error));
        } finally {
            deliverySubmittingRef.current = false;
        }
    }

    async function handleDeliveryTypeChange(value: string): Promise<void> {
        // Latest-wins: any newer toggle or basket check makes this call's answer stale.
        const call = ++gateCallRef.current;
        if (value !== "Delivery") {
            gatedBasketKeyRef.current = null;
            checkout.setOrderType(value);
            return;
        }
        gatedBasketKeyRef.current = basketKey;
        const result = await deliveryAvailability.check(undefined, deliveryBasket);
        if (call !== gateCallRef.current) return;
        if (result.available) {
            checkout.setOrderType("Delivery");
            return;
        }
        checkout.setOrderType("Pick Up");
        keetaContextRef.current = { stage: "CART", reason: result.reason };
        setKeetaOpen(true);
    }

    // The basket can change while Delivery is already selected (a line added or removed), and a
    // basket that fitted the couriers a moment ago may not any more. Re-check on every change; the
    // key ref stops the check the toggle itself just ran from being repeated.
    useEffect(() => {
        if (checkout.orderType !== "Delivery") {
            gatedBasketKeyRef.current = null;
            return;
        }
        if (gatedBasketKeyRef.current === null) {
            // Delivery was already selected before this ran (the toggle records its own baseline):
            // adopt the current basket as the baseline instead of asking again on mount.
            gatedBasketKeyRef.current = basketKey;
            return;
        }
        if (gatedBasketKeyRef.current === basketKey) return;
        gatedBasketKeyRef.current = basketKey;
        const call = ++gateCallRef.current;
        void deliveryAvailability.check(undefined, deliveryBasket).then((result) => {
            if (call !== gateCallRef.current || result.available) return;
            checkout.setOrderType("Pick Up");
            keetaContextRef.current = { stage: "CART", reason: result.reason };
            setKeetaOpen(true);
        });
    }, [checkout.orderType, basketKey, deliveryBasket, deliveryAvailability.check, checkout.setOrderType, setKeetaOpen]);

    function openPizzaEditPopUp(item: CartItem): void {
        cart.setEditItem(item);
        cart.setEditMode(true);
        cart.setPizzaPopupOpen(true);
        cart.setPopupGroup(pizzas.find(g => g.items.some(i => i.name === item.name)) ?? null);
    }

    function openPizzaComboEditPopup(item: CartItem): void {
        cart.setEditItem(item);
        cart.setEditMode(true);
        cart.setPopupGroup(menuData.filter(m => m.name === item.name && m.category === "Combo Deals"));
        cart.setPizzaComboPopupOpen(true);
    }

    function openDetroitComboEditPopup(item: CartItem): void {
        cart.setEditItem(item);
        cart.setEditMode(true);
        cart.setPopupGroup(menuData.filter(m => m.name === item.name && m.category === "Combo Deals"));
        cart.setDetroitComboPopupOpen(true);
    }

    return (
        <>
            {cart.pizzaPopupOpen && (
                <PizzaPopup
                    open={cart.pizzaPopupOpen}
                    group={cart.popupGroup as Group}
                    extraIngredients={extraIngredients}
                    toppings={toppings}
                    editItem={cart.editItem}
                    onClose={() => { cart.setPizzaPopupOpen(false); cart.setPopupGroup(null); cart.setEditMode(false); }}
                    onAddToCart={cart.handleAddToCart}
                    crossSellItems={checkout.generalCrossSellItems}
                    removeFromCart={cart.removeFromCart}
                    isEditMode={cart.editMode}
                    isSDoughAvailable={isSDoughAvailable}
                    isAdmin={isAdmin}
                />
            )}

            {cart.comboPopupOpen && (
                <ComboPopup
                    open={cart.comboPopupOpen}
                    group={cart.popupGroup as Group}
                    uniquePizzas={pizzas}
                    onClose={() => { cart.setComboPopupOpen(false); cart.setPopupGroup(null); }}
                    onAddToCart={cart.handleAddToCart}
                />
            )}

            {branchSelector && (
                <KioskBranchSelector
                    open={!!branchSelector}
                    branches={availableBranches}
                    onSelect={(branch: IBranch) => {
                        writeKioskBranch(branch);
                        setBranchSelector(false);
                        // Reload the menu for the just-selected branch; the initial fetch ran
                        // against the default branch because no branch was stored yet.
                        refreshMenu();
                    }}
                />
            )}

            {/* One mount serves both the mandatory first-visit gate (§6.2, non-dismissable) and the
                voluntary re-entry chip (§6.4, dismissable) — the gate always wins the non-dismissable
                behaviour when both flags happen to be true, since it is the one that must never be
                escaped without a choice. */}
            {(customerBranchGateOpen || branchSwitch.pickerOpen) && (
                <BranchPickerDrawer
                    open={customerBranchGateOpen || branchSwitch.pickerOpen}
                    branches={availableBranches}
                    cartItems={cart.cartItems}
                    dismissable={!customerBranchGateOpen}
                    onClose={!customerBranchGateOpen ? branchSwitch.closePicker : undefined}
                    onSelect={customerBranchGateOpen ? onCustomerBranchSelect : branchSwitch.handleBranchSelected}
                />
            )}

            <BranchSwitchWarningDrawer
                open={branchSwitch.warningOpen}
                loading={branchSwitch.warningLoading}
                targetBranch={branchSwitch.warningTargetBranch}
                unavailableNames={branchSwitch.warningUnavailableNames}
                error={branchSwitch.warningError}
                onConfirm={branchSwitch.confirmSwitch}
                onCancel={branchSwitch.cancelSwitch}
            />

            {cart.pizzaComboPopupOpen && (
                <PizzaComboPopup
                    open
                    onClose={() => { cart.setPizzaComboPopupOpen(false); cart.setPopupGroup(null); }}
                    comboGroup={cart.popupGroup as MenuItem[]}
                    pizzas={pizzas}
                    drinks={beverages}
                    sauces={sauces}
                    onAddToCart={cart.handleAddToCart}
                    selectedPizza={cart.upsellItem}
                    editItem={cart.editItem}
                    isEditMode={cart.editMode}
                    removeFromCart={cart.removeFromCart}
                    isSDoughAvailable={isSDoughAvailable}
                    isAdmin={isAdmin}
                    extraIngredients={extraIngredients}
                    toppings={toppings}
                />
            )}

            {cart.detroitComboPopupOpen && (
                <DetroitComboPopup
                    open
                    onClose={() => { cart.setDetroitComboPopupOpen(false); cart.setPopupGroup(null); }}
                    combo={cart.popupGroup as Group | MenuItem[]}
                    bricks={brickPizzas}
                    drinks={beverages}
                    sauces={sauces}
                    onAddToCart={cart.handleAddToCart}
                    selectedDetroitPizza={cart.upsellItem}
                    editItem={cart.editItem}
                    isEditMode={cart.editMode}
                    removeFromCart={cart.removeFromCart}
                />
            )}

            {cart.upsellPopupOpen && (
                <UpsellPopup
                    open
                    onClose={() => cart.setUpsellPopupOpen(false)}
                    upsellItem={cart.upsellItem}
                    upsellType={cart.upsellType ?? ""}
                    onAccept={cart.handleUpsellAccept}
                    onDecline={cart.handleUpsellDecline}
                    photo={cart.comboOfferPhoto ?? undefined}
                    comboPrice={cart.comboPrice ?? 0}
                />
            )}

            {cart.genericPopupOpen && (
                <GenericItemPopupContent
                    open={cart.genericPopupOpen}
                    group={cart.popupGroup as Group}
                    onClose={() => { cart.setGenericPopupOpen(false); cart.setPopupGroup(null); }}
                    onAddToCart={cart.handleAddToCart}
                    crossSellItems={checkout.generalCrossSellItems}
                    extraIngredients={extraIngredients}
                />
            )}

            {checkout.isCrossSellOpen && (
                <CrossSellPopup
                    open={checkout.isCrossSellOpen}
                    crossSellItems={checkout.finalCrossSellItems}
                    onClose={() => checkout.setIsCrossSellOpen(false)}
                    onAddToCart={cart.handleAddToCart}
                    onCheckout={() => checkout.handleCheckout(cart.cartItems, null, null, checkout.orderType, checkout.paymentMethod, "", null, false)}
                />
            )}

            {cart.baguettePizzaPopupOpen && (
                <BaguettePizzaPopup
                    open={cart.baguettePizzaPopupOpen}
                    onClose={() => { cart.setPopupGroup(null); cart.setBaguettePizzaPopupOpen(false); }}
                    onAddToCart={cart.handleAddToCart}
                    crossSellItems={checkout.finalCrossSellItems}
                    removeFromCart={cart.removeFromCart}
                    menuItem={(cart.popupGroup as Group).items[0]}
                />
            )}

            {cart.cartOpen && (
                <CartPopup
                    open={cart.cartOpen}
                    items={cart.cartItems}
                    onClose={() => cart.setCartOpen(false)}
                    onChangeQuantity={cart.handleChangeQuantity}
                    onChangeSize={cart.handleChangeSize}
                    onRemoveItem={cart.handleRemoveItemFromCart}
                    onCheckout={checkout.handleCheckout}
                    openPizzaEditPopUp={openPizzaEditPopUp}
                    openPizzaComboEditPopup={openPizzaComboEditPopup}
                    openDetroitComboEditPopup={openDetroitComboEditPopup}
                    isAdmin={isAdmin}
                    handleDiscountChange={cart.handleDiscountChange}
                    menuData={menuData}
                    toppings={toppings}
                    extras={extraIngredients}
                    unavailablePopupOpen={checkout.unavailablePopupOpen}
                    unavailableItems={checkout.unavailableItems}
                    unavailableMessage={checkout.unavailableMessage}
                    onCloseUnavailablePopup={() => { checkout.setUnavailablePopupOpen(false); checkout.setUnavailableMessage(null); }}
                    paymentMethod={checkout.paymentMethod}
                    onPaymentChange={checkout.setPaymentMethod}
                    orderType={checkout.orderType}
                    onDeliveryTypeChange={handleDeliveryTypeChange}
                    isKiosk={isKiosk}
                    pickupBranch={pickupBranch}
                    // The picker opens ON TOP of the still-open cart rather than replacing it, so
                    // closing or confirming it lands the customer back in the cart, not the menu.
                    onChangeBranch={branchSwitch.openPicker}
                    applePay={applePay}
                    cardPayment={cardPayment}
                />
            )}

            <DeliveryCheckoutDrawer
                open={checkout.pendingDeliveryOrder !== null}
                items={cart.cartItems}
                onClose={() => checkout.setPendingDeliveryOrder(null)}
                onConfirm={(address, availability, method) => {
                    void handleDeliveryConfirm(address, availability, method);
                }}
                onUnavailable={(availability) => {
                    keetaContextRef.current = { stage: "ADDRESS", reason: availability.reason };
                    checkout.setPendingDeliveryOrder(null);
                    setKeetaOpen(true);
                }}
            />

            <Snackbar
                open={deliveryNotice !== null}
                autoHideDuration={6000}
                onClose={() => setDeliveryNotice(null)}
                message={deliveryNotice ?? ""}
            />

            <KeetaFallbackCard
                open={keetaOpen}
                reason={deliveryAvailability.availability?.reason ?? null}
                onClose={() => setKeetaOpen(false)}
                onKeetaChosen={handleKeetaChosen}
            />

            {cart.closedPopup && <ClosedPopup open={cart.closedPopup} onClose={() => cart.setClosedPopupOpen(false)} workingHours={workingHours} />}

            {checkout.phonePopupOpen && (
                <ClientInfoPopup
                    isPhonePopupOpen={checkout.phonePopupOpen}
                    branches={availableBranches.map(b => ({ ...b, id: String(b.id) }))}
                    onClose={() => checkout.setPhonePopupOpen(false)}
                    onSave={(tel: string, customerName: string, branchId: string) => {
                        checkout.handleCheckout(cart.cartItems, tel, customerName, checkout.orderType, checkout.paymentMethod, "", branchId, true);
                    }}
                    phoneNumber={checkout.customerPrefill?.phone ?? phone.toString()}
                    customerName={checkout.customerPrefill?.name ?? username}
                    prefillAddress={checkout.customerPrefill?.address ?? undefined}
                    orderType={checkout.orderType}
                />
            )}

            {checkout.adminOrderDetailsPopUp && (
                <AdminOrderDetailsPopUp
                    isAdminOrderDetailsPopUpOpen={checkout.adminOrderDetailsPopUp}
                    onClose={() => checkout.setAdminOrderDetailsPopUpOpen(false)}
                    onSave={(tel: string, customerName: string, deliveryMethod: string, paymentMethod: string, notes: string) =>
                        checkout.handleCheckout(cart.cartItems, tel, customerName, deliveryMethod, paymentMethod, notes, adminBranchId, true)
                    }
                    cartItems={cart.cartItems}
                    setCartItems={cart.setCartItems}
                />
            )}

            {checkout.pickUpReminder && pendingOrder && (
                <PickUpReminderPopup
                    // Dismissing must never lose the order the customer already built (and
                    // verified over OTP): hand them back their cart, same as the OTP-dismissal
                    // branch in useCheckout.
                    onClose={() => {
                        checkout.setPickUpReminder(false);
                        cart.setCartOpen(true);
                    }}
                    onClick={() => {
                        checkout.setPickUpReminder(false);
                        checkout.executeOrderCreation(pendingOrder, checkout.pendingCartItems);
                    }}
                    disabled={checkout.checkoutLoading}
                />
            )}

            {applePay?.reminderOpen && (
                <PickUpReminderPopup
                    onClose={applePay.dismissReminder}
                    onClick={applePay.continueFromReminder}
                    disabled={applePay.busy}
                />
            )}

            {!isAdmin && checkout.showOrderConfirmed && (
                <OrderConfirmed open onClose={() => checkout.setShowOrderConfirmed(false)} />
            )}

            {checkout.blacklistSnackBarOpen && (
                <ErrorSnackbar
                    open={checkout.blacklistSnackBarOpen}
                    message={t("blacklist.notice")}
                    severity="error"
                    handleClose={() => checkout.setBlacklistSnackBarOpen(false)}
                    duration={10000}
                />
            )}

            <ErrorSnackbar
                open={checkout.errorSnackBarOpen}
                message={checkout.errorMessage}
                severity="error"
                handleClose={() => checkout.setErrorSnackBarOpen(false)}
            />

            {applePay?.error && (
                <ErrorSnackbar
                    open
                    message={applePay.error}
                    severity="error"
                    handleClose={applePay.clearError}
                    duration={8000}
                />
            )}

            <ApplePayNotice message={applePay?.notice ?? null} />

            {cardPayment && (
                <CardPaymentDrawer
                    open={cardPayment.drawerOpen}
                    step={cardPayment.step}
                    total={computeSheetTotal(cart.cartItems).sheetAmount}
                    fieldErrors={cardPayment.fieldErrors}
                    error={cardPayment.error}
                    fieldContainerRef={cardPayment.fieldContainerRef}
                    onClose={cardPayment.closeDrawer}
                    onPay={cardPayment.submit}
                    onRetry={cardPayment.retryWithNewSession}
                />
            )}

            {/* While the drawer is open the same message is shown inline, where the customer is looking. */}
            {cardPayment?.error && !cardPayment.drawerOpen && (
                <ErrorSnackbar
                    open
                    message={cardPayment.error}
                    severity="error"
                    handleClose={cardPayment.clearError}
                    duration={8000}
                />
            )}

            <ApplePayNotice message={cardPayment?.notice ?? null} />

            {!cart.cartOpen && checkout.unavailablePopupOpen && (
                <UnavailablePopup
                    standalone
                    open={checkout.unavailablePopupOpen}
                    onClose={() => { checkout.setUnavailablePopupOpen(false); checkout.setUnavailableMessage(null); }}
                    unavailableItems={checkout.unavailableItems}
                    message={checkout.unavailableMessage ?? undefined}
                />
            )}

            {/* Kiosk checkout: phone number, then the order number to quote at the counter. Both
                sheets are driven purely by the checkout hook's phase, so at most one is ever
                mounted, and neither touches checkoutLoading (which would unmount this whole tree
                behind a full-page loader). */}
            {isKiosk && (
                <>
                    <KioskPhoneEntrySheet
                        open={kiosk.phase === "phone"}
                        submitting={kiosk.submitting}
                        checkoutError={kiosk.checkoutError}
                        onClose={kiosk.closePhoneStep}
                        onSubmit={(tel: string, name: string) => { void kiosk.submitPhone(tel, name); }}
                    />

                    <KioskOrderPlacedSheet
                        open={kiosk.phase === "placed"}
                        orderId={kiosk.placedOrderId}
                        onDone={kiosk.finishSession}
                    />
                </>
            )}
            {/* The wallet QR. Opened by a successful benefitPayCheckout; the customer stays on this
                 page. Whether the payment succeeded is decided by the server, not by the widget. */}
            <BenefitPayDialog
                open={checkout.walletSession != null}
                session={checkout.walletSession}
                onFinished={(completed) => {
                    const reference = checkout.walletSession?.reference ?? null;
                    checkout.setWalletSession(null);
                    if (reference != null && completed) {
                        // Ask our own server what actually happened, then show the result page — the
                        // widget's callback is advisory and never decides an outcome.
                        void confirmBenefitPayPayment(reference)
                            .catch(() => undefined)
                            .finally(() => window.location.assign(`/payment_result?ref=${reference}`));
                    }
                }}
                onClose={() => checkout.setWalletSession(null)}
            />

        </>
    );
}
