import { useEffect } from "react";
import { Badge, Box, IconButton } from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import CloseIcon from "@mui/icons-material/Close";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useMenuData } from "../domains/menu/hooks/useMenuData";
import { useCart } from "../domains/cart/hooks/useCart";
import { useCheckout } from "../domains/order/hooks/useCheckout";
import { usePixelTracking } from "../domains/order/hooks/usePixelTracking";
import PizzaLoader from "../domains/order-status/components/animations/PizzaLoader";
import MenuSections from "../domains/menu/components/MenuSections";
import HomePageModals from "./HomePageModals";
import HeroSection from "./HeroSection";
import { groupItemsByCategory, groupAvailableItemsByName } from "../shared/utils/menuUtils";
import { isWithinWorkingHours } from "../domains/schedule/utils/isWithinWorkingHours";
import { TextButton } from "../shared/components/typography";
import type { Group, MenuItem } from "../domains/menu/types";
import type { GroupWithCategory } from "../domains/menu/components/MenuItemCardHorizontal";

interface HomePageProps {
    userParam: string | null;
    recommendedIds: string[];
    giftId: string | null;
}

const brandRed = "#E44B4C";

function HomePage({ userParam, recommendedIds, giftId }: HomePageProps): JSX.Element {
    const [searchParams, setSearchParams] = useSearchParams();
    const isAdmin = searchParams.get('isAdmin') === 'true';
    const isKiosk = searchParams.get('mode') === 'kiosk';
    const adminBranchId = searchParams.get('branchId');
    const isEditMode = searchParams.get('isEditMode') === 'true';
    const navigate = useNavigate();

    const menu = useMenuData({ userParam, recommendedIds, giftId, isKiosk, isEditMode, searchParams, setSearchParams, isAdmin, adminBranchId });
    const cart = useCart(menu.menuData, isAdmin);
    const checkout = useCheckout({
        isAdmin, isKiosk, isEditMode, adminBranchId,
        menuData: menu.menuData, cartItems: cart.cartItems,
        setCartItems: cart.setCartItems, setCartOpen: cart.setCartOpen,
        refreshMenu: menu.refreshMenu, navigate,
    });

    usePixelTracking();

    useEffect(() => {
        if (menu.pendingInitialItems.length > 0) cart.handleAddToCart(menu.pendingInitialItems, true);
    }, [menu.pendingInitialItems]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (menu.pendingUnavailableNames.length > 0) {
            checkout.setUnavailableItems(menu.pendingUnavailableNames);
            checkout.setUnavailablePopupOpen(true);
        }
    }, [menu.pendingUnavailableNames]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (cart.cartItems.length === 0) cart.setCartOpen(false);
    }, [cart.cartItems]); // eslint-disable-line react-hooks/exhaustive-deps

    if (menu.loading || checkout.checkoutLoading) return <PizzaLoader />;
    if (menu.error) return <div>Error: {menu.error}</div>;

    const availableGroups = groupAvailableItemsByName(menu.menuData, isAdmin);
    localStorage.setItem("availableMenuGroups", JSON.stringify(availableGroups));
    const groups = groupItemsByCategory(availableGroups as Parameters<typeof groupItemsByCategory>[0]);

    function handleOpenCart(): void {
        if (!isWithinWorkingHours() && !isAdmin) cart.setClosedPopupOpen(true);
        else cart.setCartOpen(true);
    }

    function handleOpenPopup(item: Group | MenuItem): void {
        const menuItem = item as MenuItem;
        if (menuItem.category === "Pizzas") {
            cart.setPopupGroup(item); cart.setPizzaPopupOpen(true);
        } else if (menuItem.category === "Combo Deals") {
            if (menuItem.name === "Pizza Combo") {
                cart.setPopupGroup(menu.menuData.filter(m => m.name === menuItem.name && m.category === "Combo Deals"));
                cart.setPizzaComboPopupOpen(true);
            } else if (menuItem.name === "Detroit Combo") {
                cart.setPopupGroup(item); cart.setDetroitComboPopupOpen(true);
            }
        } else if (menuItem.category === "Baguette Pizzas") {
            cart.setPopupGroup(item); cart.setBaguettePizzaPopupOpen(true);
        } else {
            cart.setPopupGroup(item); cart.setGenericPopupOpen(true);
        }
    }

    const noPopupOpen = !cart.pizzaPopupOpen && !cart.comboPopupOpen && !cart.genericPopupOpen && !cart.cartOpen && !checkout.phonePopupOpen && !checkout.adminOrderDetailsPopUp && !cart.pizzaComboPopupOpen && !cart.detroitComboPopupOpen && !cart.upsellPopupOpen;

    return (
        <Box sx={{ backgroundColor: "#fbfaf6" }}>
            {!isAdmin && <HeroSection isKiosk={isKiosk} />}
            <MenuSections
                groups={groups}
                handleOpenPopup={handleOpenPopup as (group: GroupWithCategory, item?: MenuItem) => void}
                handleRemoveItemFromCart={cart.handleRemoveItemFromCart}
                handleAddToCart={cart.handleAddToCart}
                handleChangeQuantity={cart.handleChangeQuantity}
                cartItems={cart.cartItems}
                isAdmin={isAdmin}
            />
            {isAdmin && noPopupOpen && (
                <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 10000 }}>
                    <IconButton onClick={() => { cart.setCartItems([]); navigate('/admin/'); }} sx={{ backgroundColor: "#ffffff", boxShadow: "0 2px 6px rgba(0,0,0,0.1)", "&:hover": { backgroundColor: "#f5f5f5" } }}>
                        <CloseIcon sx={{ fontSize: 28, color: brandRed }} />
                    </IconButton>
                </Box>
            )}
            <HomePageModals
                cart={cart} checkout={checkout} menuData={menu.menuData}
                toppings={menu.toppings} extraIngredients={menu.extraIngredients}
                availableBranches={menu.availableBranches}
                isSDoughAvailable={menu.isSDoughAvailable}
                phone={menu.phone} username={menu.username}
                branchSelector={menu.branchSelector} setBranchSelector={menu.setBranchSelector}
                refreshMenu={menu.refreshMenu}
                pizzas={groups.pizzas} brickPizzas={groups.brickPizzas}
                beverages={groups.beverages} sauces={groups.sauces}
                isAdmin={isAdmin} adminBranchId={adminBranchId}
            />
            {cart.cartItems.length > 0 && noPopupOpen && !checkout.unavailablePopupOpen && !cart.baguettePizzaPopupOpen && !cart.closedPopup && (
                <Box onClick={handleOpenCart} sx={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", width: "70vw", maxWidth: 400, zIndex: 9999, px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 999, backdropFilter: "blur(8px)", backgroundColor: "rgba(255, 255, 255, 0.7)", boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)", cursor: "pointer", "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.8)" } }}>
                    {cart.totalPrice !== "0.00" && <Box sx={{ flexGrow: 1, textAlign: "center" }}><TextButton sx={{ fontWeight: 600, color: "#000", fontSize: "1.1rem" }}>{cart.totalPrice} BHD</TextButton></Box>}
                    <Badge badgeContent={cart.cartItems.length} color="error" sx={{ "& .MuiBadge-badge": { fontSize: "12px", height: "22px", minWidth: "22px", backgroundColor: brandRed, color: "white", top: 2, right: 2 } }}>
                        <ShoppingCartIcon sx={{ color: brandRed, fontSize: 32 }} />
                    </Badge>
                </Box>
            )}
        </Box>
    );
}

export default HomePage;
