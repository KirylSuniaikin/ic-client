import { Dispatch, SetStateAction } from "react";
import PizzaPopup from "../domains/menu/components/popups/PizzaPopupContent";
import ComboPopup from "../domains/menu/components/popups/ComboPopupContent";
import { PizzaComboPopup } from "../domains/menu/components/popups/combo/PizzaComboPopup";
import { DetroitComboPopup } from "../domains/menu/components/popups/combo/DetroitComboPopup";
import { UpsellPopup } from "../domains/order/components/UpSellPopup";
import { KioskBranchSelector } from "../domains/kiosk/components/KioskBranchSelector";
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
import type { UseCartResult } from "../domains/cart/hooks/useCart";
import type { UseCheckoutResult } from "../domains/order/hooks/useCheckout";
import type { CartItem, ExtraIngr, Group, MenuItem, Topping } from "../domains/menu/types";
import type { IBranch } from "../domains/management/inventory/types";

const BRANCH_KEY = 'kiosk_branch_data';

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
    refreshMenu: () => Promise<void>;
    pizzas: Group[];
    brickPizzas: Group[];
    beverages: Group[];
    sauces: Group[];
    isAdmin: boolean;
    adminBranchId: string | null;
}

export default function HomePageModals({
    cart, checkout, menuData, toppings, extraIngredients, availableBranches,
    isSDoughAvailable, phone, username,
    branchSelector, setBranchSelector, refreshMenu,
    pizzas, brickPizzas, beverages, sauces, isAdmin, adminBranchId,
}: HomePageModalsProps): JSX.Element {

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
                        localStorage.setItem(BRANCH_KEY, JSON.stringify(branch));
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
                    onCheckout={() => checkout.handleCheckout(cart.cartItems, phone, null, null, null, "", null)}
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
                    unavailablePopupOpen={checkout.unavailablePopupOpen}
                    unavailableItems={checkout.unavailableItems}
                    unavailableMessage={checkout.unavailableMessage}
                    onCloseUnavailablePopup={() => { checkout.setUnavailablePopupOpen(false); checkout.setUnavailableMessage(null); }}
                />
            )}

            {cart.closedPopup && <ClosedPopup open={cart.closedPopup} onClose={() => cart.setClosedPopupOpen(false)} />}

            {checkout.phonePopupOpen && (
                <ClientInfoPopup
                    isPhonePopupOpen={checkout.phonePopupOpen}
                    branches={availableBranches.map(b => ({ ...b, id: String(b.id) }))}
                    onClose={() => checkout.setPhonePopupOpen(false)}
                    onSave={(tel: string, paymentMethod: string, customerName: string, notes: string, branchId: string) => {
                        checkout.handleCheckout(cart.cartItems, tel, customerName, "Pick Up", paymentMethod, notes, branchId);
                    }}
                    phoneNumber={phone.toString()}
                    customerName={username}
                />
            )}

            {checkout.adminOrderDetailsPopUp && (
                <AdminOrderDetailsPopUp
                    isAdminOrderDetailsPopUpOpen={checkout.adminOrderDetailsPopUp}
                    onClose={() => checkout.setAdminOrderDetailsPopUpOpen(false)}
                    onSave={(tel: string, customerName: string, deliveryMethod: string, paymentMethod: string, notes: string) =>
                        checkout.handleCheckout(cart.cartItems, tel, customerName, deliveryMethod, paymentMethod, notes, adminBranchId)
                    }
                    cartItems={cart.cartItems}
                    setCartItems={cart.setCartItems}
                />
            )}

            {checkout.pickUpReminder && (
                <PickUpReminderPopup
                    onClose={() => checkout.setPickUpReminder(false)}
                    onClick={() => {
                        checkout.setPickUpReminder(false);
                        checkout.executeOrderCreation(checkout.pendingOrder, checkout.pendingCartItems);
                    }}
                />
            )}

            {!isAdmin && checkout.showOrderConfirmed && (
                <OrderConfirmed open onClose={() => checkout.setShowOrderConfirmed(false)} />
            )}

            {checkout.blacklistSnackBarOpen && (
                <ErrorSnackbar
                    open={checkout.blacklistSnackBarOpen}
                    message="You have been blacklisted. If this is a mistake, please call +97333607710"
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
        </>
    );
}
