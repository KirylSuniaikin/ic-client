import {useEffect, useRef, useState} from "react";
import {Badge, Box, CardMedia, Fab, IconButton, Typography} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import jahezLogo from "./assets/jahez-logo.png";
import talabatLogo from "./assets/talabat-logo.png";
import {useSearchParams} from 'react-router-dom';
import {useNavigate} from "react-router-dom";


import MenuItemCardHorizontal from "./components/MenuItemCardHorizontal";
import CartComponent from "./components/CartComponent";
import PizzaPopup from "./components/PizzaPopupContent";

import {createOrder, editOrder, fetchBaseAppInfo} from "./api/api";
import {groupItemsByCategory} from "./services/item_services";
import ComboPopup from "./components/ComboPopupContent";
import ClientInfoPopup from "./components/ClientInfoPopup";
import AdminOrderDetailsPopUp from "./adminComponents/AdminOrderDetailsPopUp";
import GenericItemPopupContent from "./components/GenericItemPopupContent";
import CloseIcon from "@mui/icons-material/Close";
import OrderConfirmed from "./components/OrderConfirmed";
import PizzaLoader from "./loadingAnimations/PizzaLoader";
import CrossSellPopup from "./components/CrossSellPopup";
import {groupAvailableItemsByName} from "./utils/menu_service";

const brandRed = "#E44B4C";

function HomePage({userParam}) {
    const [menuData, setMenuData] = useState([]);
    const [extraIngredients, setExtraIngredients] = useState([]);
    const [cartItems, setCartItems] = useState([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [username, setUsername] = useState("");
    const [phone, setPhone] = useState("");

    const [pizzaPopupOpen, setPizzaPopupOpen] = useState(false);
    const [comboPopupOpen, setComboPopupOpen] = useState(false);
    const [genericPopupOpen, setGenericPopupOpen] = useState(false);
    const [popupGroup, setPopupGroup] = useState(null);
    const [editItem, setEditItem] = useState(null);
    const [phonePopupOpen, setPhonePopupOpen] = useState(false);
    const [adminOrderDetailsPopUp, setAdminOrderDetailsPopUpOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editMode, setEditMode] = useState(false)

    const [searchParams] = useSearchParams();
    const isAdmin = searchParams.get('isAdmin') === 'true';
    const isEditMode = searchParams.get('isEditMode') === 'true';
    const isAdminConfirmedRef = useRef(false);
    const navigate = useNavigate();
    const [showOrderConfirmed, setShowOrderConfirmed] = useState(false);
    const [wasCrossSellShown, setWasCrossSellShown] = useState(false);
    const [isCrossSellOpen, setIsCrossSellOpen] = useState(false);
    const generalCrossSell = ["Hot Honey Sauce", "Ranch Sauce", "Coca Cola Zero"]
    const finalCrossSell = ["BBQ Chicken Ranch Detroit Brick", "Coca Cola Zero", "Ranch Sauce", "Hot Honey Sauce", "Pizza Rolls", "Water"]

    const handleDiscountChange = (item, newDiscount) => {
        const updatedItems = cartItems.map((i) =>
            i === item ? {...i, discount: newDiscount} : i
        );
        setCartItems(updatedItems);
    };
    const PIXEL_ID = '1717861405707714';

    useEffect(() => {
        if (!window.fbq) {
            (function (f, b, e, v, n, t, s) {
                if (f.fbq) return;
                n = f.fbq = function () {
                    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
                };
                if (!f._fbq) f._fbq = n;
                n.push = n;
                n.loaded = !0;
                n.version = '2.0';
                n.queue = [];
                t = b.createElement(e);
                t.async = !0;
                t.src = v;
                s = b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t, s);
            })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        }

        window.fbq('init', PIXEL_ID);
        window.fbq('track', 'HomePage');

        async function load() {
            try {
                setLoading(true);
                const baseInfo = await fetchBaseAppInfo(userParam);
                setMenuData(baseInfo.menu);
                setExtraIngredients(baseInfo.extraIngr)
                if(baseInfo.userInfo && baseInfo.userInfo.name && baseInfo.userInfo.name !== "Unknown user"){
                    setUsername(baseInfo.userInfo.name)
                }
                if (baseInfo.userInfo && baseInfo.userInfo.phone) {
                    setPhone(baseInfo.userInfo.phone);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        load();

        if (isEditMode) {
            const rawOrder = localStorage.getItem("orderToEdit");
            console.log(rawOrder)
            if (rawOrder) {
                try {
                    const parsed = JSON.parse(rawOrder);
                    if (Array.isArray(parsed.items)) {
                        const normalized = parsed.items.map(item => {
                            const discount = item.discount_amount && item.quantity
                                ? Math.round((item.discount_amount / (item.amount + item.discount_amount) * 100))
                                : 0;

                            const originalAmount = item.amount + (item.discount_amount || 0);

                            return {
                                ...item,
                                quantity: item.quantity || 1,
                                discount,
                                amount: originalAmount,
                                note: parseItemNote(item.description),
                                extraIngredients: parseExtraIngr(item.description)
                            };
                        });
                        setCartItems(normalized);
                    }
                } catch (e) {
                    console.error("Error:", e);
                }
            }
        }

    }, []);


    function parseItemNote(desc) {
        let note = "";

        const hasParentheses = /\(.*?\)/.test(desc);
        let restPart = desc;

        if (hasParentheses) {
            const lastParenIndex = desc.lastIndexOf(")");
            restPart = desc.substring(lastParenIndex + 1);
        }

        const plusRegex = /\+([^\+]+)/g;
        let match;
        while ((match = plusRegex.exec(restPart)) !== null) {
            let text = match[1].trim();
            if (text !== "Thin") {
                note += (note ? " " : "") + text;
            }
        }
        console.log(note)
        return note.trim();
    }

    function parseExtraIngr(desc) {
        const extras = [];
        const regex = /\((.*?)\)/g;
        let match;
        while ((match = regex.exec(desc)) !== null) {
            const ingr = match[1]
                .split("+")
                .map(s => s.trim())
                .filter(s => s.length > 0);
            extras.push(...ingr);
        }
        console.log(extras)
        return extras;
    }
    useEffect(() => {
        if (cartItems.length === 0) {
            setCartOpen(false);
        }
    }, [cartItems]);


    if (loading) return <PizzaLoader/>;
    if (error) return <div>Error: {error}</div>;

    const {bestsellers, brickPizzas, combos, pizzas, sides, beverages, sauces} = groupItemsByCategory(groupAvailableItemsByName(menuData));

    function getGeneralCrossSellItems() {
        return generalCrossSell
            .map(name => menuData.find(item => item.name === name))
            .filter(Boolean);
    }

    function getFinalCrossSell() {
        return finalCrossSell
            .map(name => menuData.find(item => item.name === name))
            .filter(Boolean);
    }

    function openPizzaEditPopUp(item) {
        setEditItem(item)
        setEditMode(true)
        setPizzaPopupOpen(true)
        setPopupGroup(pizzas.find(group =>
            group.items.some(i => i.name === item.name)
        ))
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

    const handleOpenCart = () => {
        setCartOpen(true)
    };
    const handleCloseCart = () => setCartOpen(false);

    const handleOpenPopup = (item) => {
        if (item.category === "Pizzas") {
            setPopupGroup(item);
            setPizzaPopupOpen(true);
        }
        if (item.category === "Combo Deals") {
            setPopupGroup(item);
            setComboPopupOpen(true);
        } else if (item.category !== "Combo Deals" && item.category !== "Pizzas") {
            setPopupGroup(item);
            setGenericPopupOpen(true);
        }
    };
    const handleClosePizzaPopup = () => {
        setPizzaPopupOpen(false)
        setPopupGroup(null)
        setEditMode(false)
    };

    const handleCloseComboPopup = () => {
        setComboPopupOpen(false);
        setPopupGroup(null);
    };

    const handleCloseGenericPopup = () => {
        setGenericPopupOpen(false);
        setPopupGroup(null);
    }

    const handleClosePhonePopup = () => {
        setPhonePopupOpen(false);
    }

    function handleAddToCart(items) {
        setCartItems(prev => [
            ...prev,
            ...(Array.isArray(items) ? items : [items])
        ]);

        handleClosePizzaPopup();
        handleCloseComboPopup();
    }

    function removeFromCart(name, amount, quantity) {
        setCartItems(prev =>
            prev.filter(item =>
                !(item.name === name && item.amount === amount && item.quantity === quantity)
            )
        );
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

    function handleChangeSize(item, newSize){
        const sameItems = getSameItems(item.name)
        const matched = sameItems ? sameItems.find(it => it.size === newSize) : null;
        const newBasePrice = matched ? matched.price : (item.sizes?.[newSize] || item.price || 0);
        setCartItems(prev =>
            prev.map(it => (it === item ? {...it, amount: newBasePrice, size: newSize} : it))
        );
    }

    const handleCloseAdminOrderDetailsPopup = () => {
        setAdminOrderDetailsPopUpOpen(false);
    }


    const buildOrderTO = (
        orderToEdit,
        tel,
        customer_name,
        delivery_method,
        payment_type,
        items,
        notes
    ) => {
        return {
            id: orderToEdit.id,
            order_no: orderToEdit.order_no,
            tel,
            user_id: user,
            customer_name: customer_name,
            delivery_method: delivery_method,
            payment_type: payment_type,
            address: orderToEdit.address,
            notes: notes,
            items: items.map(item => {
                const discount = typeof item.discount === "number" ? item.discount : 0;
                const discountAmount = item.amount * (discount / 100) * item.quantity;

                return {
                    name: item.name,
                    quantity: item.quantity,
                    amount: item.amount,
                    size: item.size || "",
                    category: item.category,
                    description: item.description || "",
                    isGarlicCrust: item.isGarlicCrust || false,
                    isThinDough: item.isThinDough || false,
                    discount_amount: parseFloat(discountAmount.toFixed(3))
                };
            }),
            amount_paid: parseFloat(
                items.reduce((acc, item) => {
                    const discount = typeof item.discount === "number" ? item.discount : 0;
                    const discountedPrice = item.amount * (1 - discount / 100);
                    return acc + discountedPrice * item.quantity;
                }, 0).toFixed(3)
            )
        }
    };

    async function handleCheckout(
        items,
        tel,
        customerName = null,
        deliveryMethod = null,
        paymentMethod = null,
        notes,
    ) {
        if (!wasCrossSellShown) {
            setIsCrossSellOpen(true);
            setWasCrossSellShown(true);
            return;
        }
        if (paymentMethod === null) {
            setCartOpen(false);
            if(isAdmin){
                setAdminOrderDetailsPopUpOpen(true);
            } else setPhonePopupOpen(true);
        } else if (isAdmin && isEditMode) {
            setLoading(true);
            try {
                const orderToEdit = JSON.parse(localStorage.getItem("orderToEdit"))
                const order = buildOrderTO(orderToEdit, tel, customerName, deliveryMethod, paymentMethod, items, notes);
                console.log(order)
                await editOrder(order, orderToEdit.id);
                await localStorage.removeItem("orderToEdit");
                setCartOpen(false);
                navigate("/admin/");
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        } else {
            const order = {
                tel,
                user_id: user,
                customer_name: customerName,
                delivery_method: "Pick Up",
                payment_type: paymentMethod,
                notes: notes,
                items: items.map(item => {
                    const discount = typeof item.discount === "number" ? item.discount : 0;
                    const discountAmount = item.amount * (discount / 100) * item.quantity;
                    const discountedAmount = item.amount * (1 - discount / 100);

                    return {
                        name: item.name,
                        quantity: item.quantity,
                        amount: parseFloat(discountedAmount.toFixed(3)),
                        size: item.size || "",
                        category: item.category,
                        description: item.description || "",
                        isGarlicCrust: item.isGarlicCrust || false,
                        isThinDough: item.isThinDough || false,
                        discount_amount: parseFloat(discountAmount.toFixed(3))
                    };
                }),
                amount_paid: parseFloat(
                    items.reduce((acc, item) => {
                        const discount = typeof item.discount === "number" ? item.discount : 0;
                        const discountedPrice = item.amount * (1 - discount / 100);
                        return acc + discountedPrice * item.quantity;
                    }, 0).toFixed(3)
                ),
            };
            setCartItems([]);
            setShowOrderConfirmed(true);

            try {
                let response;

                if (isAdmin) {
                    setLoading(true);
                    setCartItems([]);
                    isAdminConfirmedRef.current = false;
                    response = await createOrder(order)
                    setLoading(false)
                    navigate("/admin/")
                } else {
                    response = await createOrder(order);
                }
                console.log("Order placed successfully:", response);
                setCartItems([]);
            } catch (error) {
                console.error("Error placing order:", error);
            } finally {
                setCartOpen(false);
            }
        }
    }

    return (
        <Box sx={{p: 2}}>
            {
                !pizzaPopupOpen &&
                !comboPopupOpen &&
                !genericPopupOpen &&
                !cartOpen &&
                !phonePopupOpen &&
                !adminOrderDetailsPopUp &&
                isAdmin && (
                    <Box sx={{
                        position: 'fixed',
                        top: 16,
                        right: 16,
                        zIndex: 10000
                    }}
                    >
                        <IconButton
                            onClick={() => {
                                setCartItems([]);
                                navigate('/admin/');
                            }}
                            sx={{
                                backgroundColor: "#ffffff",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                                "&:hover": {
                                    backgroundColor: "#f5f5f5"
                                }
                            }}
                        >
                            <CloseIcon sx={{fontSize: 28, color: "#E44B4C"}}/>
                        </IconButton>
                    </Box>


                )}
            {!isAdmin && (
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
            )}

            {/* BESTSELLERS */}
            {bestsellers.length > 0 && (
                <Box sx={{mb: 2}}>
                    <Typography fontWeight="bold" variant="h6">
                        Bestsellers
                    </Typography>
                    {bestsellers.map(group => (
                        <MenuItemCardHorizontal
                            key={group.name}
                            group={group}
                            onSelect={handleOpenPopup}
                            isBestSellerBlock={true}
                        />
                    ))}
                </Box>
            )}

            {/* BRICK PIZZAS */}
            {brickPizzas.length > 0 && (
                <Box sx={{mb: 2}}>
                    <Typography fontWeight="bold" variant="h6">
                        Detroit Brick Pizzas
                    </Typography>
                    {brickPizzas.map(group => (
                        <MenuItemCardHorizontal
                            key={group.name}
                            group={group}
                            onSelect={handleOpenPopup}
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
                    {combos.map(group => (
                        <MenuItemCardHorizontal
                            key={group.name}
                            group={group}
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
                    {pizzas.map(group => (
                        <MenuItemCardHorizontal
                            key={group.name}
                            group={group}
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
                    {sides.map(group => (
                        <MenuItemCardHorizontal
                            key={group.name}
                            group={group}
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
                    {sauces.map(group => (
                        <MenuItemCardHorizontal
                            key={group.name}
                            group={group}
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
                    {beverages.map(group => (
                        <MenuItemCardHorizontal
                            key={group.name}
                            group={group}
                            onSelect={handleOpenPopup}
                        />
                    ))}
                </Box>
            )}

            {pizzaPopupOpen && <PizzaPopup
                open={pizzaPopupOpen}
                group={popupGroup}
                extraIngredients={extraIngredients}
                editItem={editItem}
                onClose={handleClosePizzaPopup}
                onAddToCart={handleAddToCart}
                crossSellItems={getGeneralCrossSellItems()}
                removeFromCart={removeFromCart}
                isEditMode={editMode}
            />
            }

            {comboPopupOpen && <ComboPopup
                open={comboPopupOpen}
                group={popupGroup}
                uniquePizzas={pizzas}
                onClose={handleCloseComboPopup}
                onAddToCart={handleAddToCart}
            />
            }

            {genericPopupOpen && <GenericItemPopupContent
                open={genericPopupOpen}
                group={popupGroup}
                onClose={handleCloseGenericPopup}
                onAddToCart={handleAddToCart}
                crossSellItems={getGeneralCrossSellItems()}
                extraIngredients={extraIngredients}
            />
            }

            {isCrossSellOpen && <CrossSellPopup
                open={isCrossSellOpen}
                crossSellItems={getFinalCrossSell()}
                onClose={() => setIsCrossSellOpen(false)}
                onAddToCart={handleAddToCart}
                onCheckout={handleCheckout}
            />
            }

            {cartOpen && <CartComponent
                open={cartOpen}
                items={cartItems}
                onClose={handleCloseCart}
                onChangeQuantity={handleChangeQuantity}
                onChangeSize={handleChangeSize}
                onRemoveItem={handleRemoveItemFromCart}
                onCheckout={handleCheckout}
                openPizzaEditPopUp={openPizzaEditPopUp}
                isAdmin={isAdmin}
                handleDiscountChange={handleDiscountChange}
            />
            }

            {phonePopupOpen && <ClientInfoPopup
                isPhonePopupOpen={phonePopupOpen}
                onClose={handleClosePhonePopup}
                onSave={(tel, paymentMethod, customerName, notes) => {
                    handleCheckout(cartItems, tel, customerName, "Pick Up", paymentMethod, notes);
                }}
                phoneNumber={phone.toString()}
                customerName={username}
            />
            }

            {adminOrderDetailsPopUp && <AdminOrderDetailsPopUp
                isAdminOrderDetailsPopUpOpen={adminOrderDetailsPopUp}
                onClose={handleCloseAdminOrderDetailsPopup}
                onSave={(phone, customerName, deliveryMethod, paymentMethod, notes) =>
                    handleCheckout(cartItems, phone, customerName, deliveryMethod, paymentMethod, notes)
                }
                cartItems={cartItems}
                setCartItems={setCartItems}
            />}

            {!isAdmin &&
                showOrderConfirmed && (
                    <OrderConfirmed open={true} onClose={() => setShowOrderConfirmed(false)}/>
                )}

            {!adminOrderDetailsPopUp && !phonePopupOpen && !cartOpen && !pizzaPopupOpen && !genericPopupOpen && !comboPopupOpen && cartItems.length > 0 &&
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