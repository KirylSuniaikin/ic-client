import {useEffect, useState} from "react";
import {Badge, Box, CardMedia, Fab, Typography} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import jahezLogo from "./assets/jahez-logo.png";
import talabatLogo from "./assets/talabat-logo.png";


import MenuItemCardHorizontal from "./components/MenuItemCardHorizontal";
import CartComponent from "./components/CartComponent";
import PizzaPopup from "./components/PizzaPopupContent";

import {createOrder, fetchExtraIngredients, fetchMenu} from "./api/api";
import {groupItemsByCategory} from "./services/item_services";
import ComboPopup from "./components/ComboPopupContent";
import PhonePopup from "./components/PhonePopup";
import GenericItemPopupContent from "./components/GenericItemPopupContent";

const brandRed = "#E44B4C";

function HomePage({userParam}) {
    const [menuData, setMenuData] = useState([]);
    const [extraIngredients, setExtraIngredients] = useState([]);
    const [cartItems, setCartItems] = useState([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [user, setUser] = useState(null);

    const [pizzaPopupOpen, setPizzaPopupOpen] = useState(false);
    const [comboPopupOpen, setComboPopupOpen] = useState(false);
    const [genericPopupOpen, setGenericPopupOpen] = useState(false);
    const [popupItem, setPopupItem] = useState(false);
    const [phonePopupOpen, setPhonePopupOpen] = useState(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (userParam) {
            setUser(userParam);
            console.log("User:", userParam);
        }

        async function loadMenu() {
            try {
                setLoading(true);
                const menu = await fetchMenu();
                const extraIngr = await fetchExtraIngredients();
                setMenuData(menu);
                setExtraIngredients(extraIngr);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadMenu();
    }, []);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    const uniqueItems = getUniqueItems(menuData);
    const {bestsellers, combos, pizzas, sides, beverages, sauces} = groupItemsByCategory(uniqueItems);

    function getUniqueItems(data) {
        const map = new Map();
        data.forEach(item => {
            if (!map.has(item.name) || item.price < map.get(item.name).price) {
                map.set(item.name, item);
            }
        });
        return Array.from(map.values());
    }

    function getSameItems(item_name) {
        const sameItems = [];
        menuData.forEach(item => {
            if (item.name === item_name) {
                sameItems.push(item);
            }
        });
        return sameItems;
    }

    const handleOpenCart = () => setCartOpen(true);
    const handleCloseCart = () => setCartOpen(false);

    const handleOpenPopup = (item) => {
        if (item.category === "Pizzas") {
            setPopupItem(item);
            setPizzaPopupOpen(true);
        }
        if (item.category === "Combo Deals") {
            setPopupItem(item);
            setComboPopupOpen(true);
        } else if (item.category !== "Combo Deals" && item.category !== "Pizzas") {
            setPopupItem(item);
            setGenericPopupOpen(true);
        }
    };
    const handleClosePizzaPopup = () => {
        setPizzaPopupOpen(false);
        setPopupItem(null);
    };

    const handleCloseComboPopup = () => {
        setComboPopupOpen(false);
        setPopupItem(null);
    };

    const handleCloseGenericPopup = () => {
        setGenericPopupOpen(false);
        setPopupItem(null);
    }

    const handleClosePhonePopup = () => {
        setPhonePopupOpen(false);
    }

    function handleAddToCart(product) {
        setCartItems(prev => [...prev, product]);
        handleClosePizzaPopup();
        handleCloseComboPopup()
    }

    function handleRemoveItemFromCart(item) {
        setCartItems(prev => prev.filter(it => it !== item));
    }

    function handleChangeQuantity(item, newQty) {
        if (newQty < 1) return;
        setCartItems(prev =>
            prev.map(it => (it === item ? {...it, quantity: newQty} : it))
        );
    }

    async function handleCheckout(items, tel) {
        if (user === null && tel===null) {
            setPhonePopupOpen(true);
            setCartOpen(false);
        } else {
            setCartOpen(false);
            const order = {
                tel: tel,
                user_id: user,
                items: cartItems,
                amount_paid: cartItems.reduce((acc, item) => acc + (item.amount * item.quantity)* item.quantity, 0)
            };

            try {
                setCartItems([]);
                const response = await createOrder(order);
                console.log("Order placed successfully:", response);
            } catch (error) {
                console.error("Error placing order:", error);
            }
        }
    }

    return (
        <Box sx={{p: 2}}>
            <Box sx={{display: "flex", flexDirection: "column", gap: 1, mb: 3}}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        cursor: "pointer"
                    }}
                    onClick={() => window.open("https://www.talabat.com/bahrain/ic-pizza", "_blank")}
                >
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            backgroundColor: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mr: 2
                        }}
                    >
                        <CardMedia
                            component="img"
                            image={talabatLogo}
                            alt="Jahez"
                            sx={{
                                width: 30,
                                height: 30,
                                objectFit: "contain",
                                borderRadius: "50%"
                            }}
                        />
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                        Available on Talabat
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        cursor: "pointer"
                    }}
                    onClick={() => window.open("https://jahez.link/Sh08ob21hSb", "_blank")}
                >
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mr: 2
                        }}
                    >
                        <CardMedia
                            component="img"
                            image={jahezLogo}
                            alt="Jahez"
                            sx={{
                                width: 40,
                                height: 40,
                                objectFit: "contain",
                                borderRadius: "50%"
                            }}
                        />
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                        Available on Jahez
                    </Typography>
                </Box>
            </Box>


            {/* BESTSELLERS */}
            {bestsellers.length > 0 && (
                <Box sx={{mb: 2}}>
                    <Typography fontWeight="bold" variant="h6">
                        Bestsellers
                    </Typography>
                    {bestsellers.map(item => (
                        <MenuItemCardHorizontal
                            key={item.item_id}
                            item={item}
                            onSelect={handleOpenPopup}
                            isBestSellerBlock={true}
                        />
                    ))}
                </Box>
            )}

            {/* COMBO DEALS */}
            {combos.length > 0 && (
                <Box sx={{mb: 2}}>
                    <Typography fontWeight="bold" variant="h6">
                        Combo Deals
                    </Typography>
                    {combos.map(item => (
                        <MenuItemCardHorizontal
                            key={item.item_id}
                            item={item}
                            onSelect={handleOpenPopup}
                        />
                    ))}
                </Box>
            )}

            {/* PIZZAS */}
            {pizzas.length > 0 && (
                <Box sx={{mb: 2}}>
                    <Typography fontWeight="bold" variant="h6">
                        Pizzas
                    </Typography>
                    {pizzas.map(item => (
                        <MenuItemCardHorizontal
                            key={item.item_id}
                            item={item}
                            onSelect={handleOpenPopup}
                        />
                    ))}
                </Box>
            )}

            {/* SIDES */}
            {sides.length > 0 && (
                <Box sx={{mb: 2}}>
                    <Typography fontWeight="bold" variant="h6">
                        Sides
                    </Typography>
                    {sides.map(item => (
                        <MenuItemCardHorizontal
                            key={item.item_id}
                            item={item}
                            onSelect={handleOpenPopup}
                        />
                    ))}
                </Box>
            )}

            {/* SAUCES */}
            {sauces.length > 0 && (
                <Box sx={{mb: 2}}>
                    <Typography fontWeight="bold" variant="h6">
                        Sauces
                    </Typography>
                    {sauces.map(item => (
                        <MenuItemCardHorizontal
                            key={item.item_id}
                            item={item}
                            onSelect={handleOpenPopup}
                        />
                    ))}
                </Box>
            )}

            {/* BEVERAGES */}
            {beverages.length > 0 && (
                <Box sx={{mb: 2}}>
                    <Typography fontWeight="bold" variant="h6">
                        Beverages
                    </Typography>
                    {beverages.map(item => (
                        <MenuItemCardHorizontal
                            key={item.item_id}
                            item={item}
                            onSelect={handleOpenPopup}
                        />
                    ))}
                </Box>
            )}


            <PizzaPopup
                open={pizzaPopupOpen}
                item={popupItem}
                extraIngredients={extraIngredients}
                sameItems={popupItem && getSameItems(popupItem.name)}
                onClose={handleClosePizzaPopup}
                onAddToCart={handleAddToCart}
            />

            <ComboPopup
                open={comboPopupOpen}
                item={popupItem}
                uniquePizzas={pizzas}
                sameItems={popupItem && getSameItems(popupItem.name)}
                onClose={handleCloseComboPopup}
                onAddToCart={handleAddToCart}
            />

            <GenericItemPopupContent
                open={genericPopupOpen}
                item={popupItem}
                onClose={handleCloseGenericPopup}
                onAddToCart={handleAddToCart}
            />

            <CartComponent
                open={cartOpen}
                items={cartItems}
                onClose={handleCloseCart}
                onChangeQuantity={handleChangeQuantity}
                onRemoveItem={handleRemoveItemFromCart}
                onCheckout={handleCheckout}
            />

            <PhonePopup
                isPhonePopupOpen={phonePopupOpen}
                onClose={handleClosePhonePopup}
                onSave={(tel) => {
                    handleCheckout(cartItems, tel);
                }}
            />

            {!cartOpen && !pizzaPopupOpen && !genericPopupOpen && !comboPopupOpen && cartItems.length > 0 &&
                <Fab
                    onClick={handleOpenCart}
                    sx={{
                        position: "fixed",
                        backgroundColor: "#fff",
                        bottom: 16,
                        right: 16,
                        zIndex: 9999,
                        color: brandRed,
                        boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.2)",
                        "&:hover": {
                            backgroundColor: "#F0F0F0",
                        }
                    }}
                >
                    <Badge
                        badgeContent={cartItems.length}
                        color="error"
                        sx={{
                            "& .MuiBadge-badge": {
                                fontSize: "14px",
                                height: "25px",
                                minWidth: "25px",
                                backgroundColor: brandRed,
                                color: "white",
                                top: 0,
                                right: 0
                            }
                        }}
                    >
                        <ShoppingCartIcon fontSize="large"/>
                    </Badge>
                </Fab>
            }
        </Box>
    );
}

export default HomePage;