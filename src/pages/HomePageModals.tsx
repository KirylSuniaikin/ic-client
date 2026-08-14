import { Dispatch, SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import PizzaPopup from "../domains/menu/components/popups/PizzaPopupContent";
import ComboPopup from "../domains/menu/components/popups/ComboPopupContent";
import { PizzaComboPopup } from "../domains/menu/components/popups/combo/PizzaComboPopup";
import { DetroitComboPopup } from "../domains/menu/components/popups/combo/DetroitComboPopup";
import { UpsellPopup } from "../domains/order/components/UpSellPopup";
import { KioskBranchSelector } from "../domains/kiosk/components/KioskBranchSelector";
import { KioskPhoneEntrySheet } from "../domains/kiosk/components/KioskPhoneEntrySheet";
import { KioskOrderPlacedSheet } from "../domains/kiosk/components/KioskOrderPlacedSheet";
import { writeKioskBranch } from "../domains/kiosk/utils/kioskBranch";
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
import { useDeliveryAvailability } from "../domains/delivery/hooks/useDeliveryAvailability";
import { DeliveryCheckoutDrawer } from "../domains/delivery/components/DeliveryCheckoutDrawer";
import { payForDelivery } from "../shared/api/delivery";
import { logger } from "../shared/utils/logger";
import { Snackbar } from "@mui/material";
import type { CustomerAddress, DeliveryAvailability, DeliveryPaymentMethod } from "../domains/delivery/types";
import type { UseCartResult } from "../domains/cart/hooks/useCart";
import type { UseCheckoutResult } from "../domains/order/hooks/useCheckout";
import type { CartItem, ExtraIngr, Group, MenuItem, Topping } from "../domains/menu/types";
import type { IBranch } from "../domains/management/inventory/types";
import type { WorkingHoursSchedule } from "../shared/api/management";

interface HomePageModalsProps {
    cart: UseCartResult;
    checkout: UseCheckoutResult;
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
}

export default function HomePageModals({
    cart, checkout, menuData, toppings, extraIngredients, availableBranches,
    isSDoughAvailable, phone, username,
    branchSelector, setBranchSelector, kiosk, refreshMenu,
    pizzas, brickPizzas, beverages, sauces, isAdmin, isKiosk, adminBranchId, workingHours,
}: HomePageModalsProps): JSX.Element {
    const { t } = useTranslation("checkout");

    // Local const so the null-check below narrows inside PickUpReminderPopup's onClick
    // (narrowing a property access would not survive into the callback).
    const pendingOrder = checkout.pendingOrder;

    const deliveryAvailability = useDeliveryAvailability();
    const [keetaOpen, setKeetaOpen] = useState(false);
    const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);

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
            if (result.stub) {
                // Never let a stubbed order read as a real charge.
                setDeliveryNotice(t("delivery.stubNotice"));
            }
            checkout.setShowOrderConfirmed(true);
        } catch (error) {
            logger.error("Delivery checkout failed:", error);
            setDeliveryNotice(error instanceof Error ? error.message : String(error));
        }
    }

    async function handleDeliveryTypeChange(value: string): Promise<void> {
        if (value !== "Delivery") {
            checkout.setOrderType(value);
            return;
        }
        const result = await deliveryAvailability.check();
        if (result.available) {
            checkout.setOrderType("Delivery");
            return;
        }
        checkout.setOrderType("Pick Up");
        setKeetaOpen(true);
    }

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
                />
            )}

            <DeliveryCheckoutDrawer
                open={checkout.pendingDeliveryOrder !== null}
                onClose={() => checkout.setPendingDeliveryOrder(null)}
                onConfirm={(address, availability, method) => {
                    void handleDeliveryConfirm(address, availability, method);
                }}
                onUnavailable={() => { checkout.setPendingDeliveryOrder(null); setKeetaOpen(true); }}
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
        </>
    );
}
