import {useEffect, useRef, useState} from "react";
import {Badge, Box, Fab, IconButton, Typography} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import {useLocation, useSearchParams} from 'react-router-dom';
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
import PizzaLoader from "./components/loadingAnimations/PizzaLoader";
import CrossSellPopup from "./components/CrossSellPopup";
import {groupAvailableItemsByName} from "./utils/menu_service";
import {isWithinWorkingHours} from "./components/scheduleComponents/isWithinWorkingHours";
import ClosedPopup from "./components/scheduleComponents/ClosedPopup";
import {TextButton, TextGroup, TextTitle} from "./utils/typography";
import {PizzaComboPopup} from "./components/comboComponents/PizzaComboPopup";
import {DetroitComboPopup} from "./components/comboComponents/DetroitComboPopup";
import {UpsellPopup} from "./components/UpSellPopup";



const brandRed = "#E44B4C";
const colorBeige = '#FCF4DD';

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
    const [pizzaComboPopupOpen, setPizzaComboPopupOpen] = useState(false);
    const [detroitComboPopupOpen, setDetroitComboPopupOpen] = useState(false);
    const [genericPopupOpen, setGenericPopupOpen] = useState(false);
    const [popupGroup, setPopupGroup] = useState(null);
    const [editItem, setEditItem] = useState(null);
    const [phonePopupOpen, setPhonePopupOpen] = useState(false);
    const [adminOrderDetailsPopUp, setAdminOrderDetailsPopUpOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editMode, setEditMode] = useState(false)
    const [closedPopup, setClosedPopupOpen] = useState(false);

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

    const [upsellPopupOpen, setUpsellPopupOpen] = useState(false);
    const [upsellItem, setUpsellItem] = useState(null);
    const [upsellType, setUpsellType] = useState(null);
    const [pendingItems, setPendingItems] = useState(null);
    const [comboOfferPhoto, setComboOfferPhoto] = useState(null);
    const [comboPrice, setComboPrice] = useState(null);

    const bestRef = useRef(null);

    const {
        bestsellers,
        brickPizzas,
        combos,
        pizzas,
        sides,
        beverages,
        sauces
    } = groupItemsByCategory(groupAvailableItemsByName(menuData));

    const location = useLocation();

    // useOscillatingAutoScroll(bestRef, {
    //     bestsellers,
    //     cycles: 2,
    //     enabled: !isAdmin && (bestsellers?.length ?? 0) > 1,
    //     initialDelay: 300,
    //     onceKey: `autoScroll:${location.pathname}`,
    //     pxPerSecond: 130,
    //     runOnce: true,
    //     onceTtlMs: 30_000,
    // });

    useEffect(() => {
        if (bestRef.current) {
            const el = bestRef.current;
        }
    }, [bestRef.current, bestsellers]);

    const handleDiscountChange = (item, newDiscount) => {
        const updatedItems = cartItems.map((i) =>
            i === item ? {...i, discount: newDiscount} : i
        );
        setCartItems(updatedItems);
    };
    const FB_PIXEL_ID = '1717861405707714';
    const TT_PIXEL_ID = 'D1SBUPRC77U25MKH1E40';

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

        window.fbq('init', FB_PIXEL_ID);
        window.fbq('track', 'HomePage');

        if (!window.ttq) {
            (function (w, d, t) {
                w.TiktokAnalyticsObject = t;
                const ttq = w[t] = w[t] || [];
                ttq.methods = [
                    "page", "track", "identify", "instances", "debug", "on", "off",
                    "once", "ready", "alias", "group", "enableCookie", "disableCookie",
                    "holdConsent", "revokeConsent", "grantConsent"
                ];
                ttq.setAndDefer = function (t, e) {
                    t[e] = function () {
                        t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
                    };
                };
                for (let i = 0; i < ttq.methods.length; i++) {
                    ttq.setAndDefer(ttq, ttq.methods[i]);

                }

                ttq.load = function (e, n) {
                    const r = "https://analytics.tiktok.com/i18n/pixel/events.js";
                    const script = d.createElement("script");
                    script.type = "text/javascript";
                    script.async = true;
                    script.src = `${r}?sdkid=${e}&lib=${t}`;
                    const f = d.getElementsByTagName("script")[0];
                    f.parentNode.insertBefore(script, f);
                };

                ttq.load(TT_PIXEL_ID);
                ttq.page();
            })(window, document, 'ttq');
        }

        async function load() {
            try {
                setLoading(true);
                const baseInfo = await fetchBaseAppInfo(userParam);
                setMenuData(baseInfo.menu);
                setExtraIngredients(baseInfo.extraIngr)
                if (baseInfo.userInfo && baseInfo.userInfo.name && baseInfo.userInfo.name !== "Unknown user") {
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
                    console.log(parsed);
                    if (Array.isArray(parsed.items)) {
                        const normalized = parsed.items.map(item => {
                            const discount = item.discountAmount && item.quantity
                                ? Math.round((item.discountAmount / (item.amount + item.discountAmount) * 100))
                                : 0;

                            const originalAmount = item.amount + (item.discountAmount || 0);

                            return {
                                ...item,
                                quantity: item.quantity || 1,
                                discount,
                                amount: originalAmount,
                                note: parseItemNote(item.description),
                                extraIngredients: parseExtraIngr(item.description),
                                comboItems: Array.isArray(item.comboItemTO)
                                    ? item.comboItemTO.map(normalizeComboItem)
                                    : []
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

    const totalPrice = cartItems
        ? cartItems.reduce((acc, i) => {
            const discount = i.discount || 0;
            const discountedPrice = i.amount * (1 - discount / 100);
            return acc + discountedPrice * i.quantity;
        }, 0).toFixed(2)
        : 0;

    useEffect(() => {
        if (cartItems.length === 0) {
            setCartOpen(false);
        }
    }, [cartItems]);

    if (loading) return <PizzaLoader/>;
    if (error) return <div>Error: {error}</div>;

    function getGeneralCrossSellItems() {
        return generalCrossSell
            .map(name => menuData.find(item => item.name === name && item.available))
            .filter(Boolean);
    }

    function getFinalCrossSell() {
        return finalCrossSell
            .map(name => menuData.find(item => item.name === name && item.available))
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
        if (!isWithinWorkingHours() && !isAdmin) {
            setClosedPopupOpen(true);
        } else {
            setCartOpen(true);
        }
    };
    const handleCloseCart = () => setCartOpen(false);

    const handleOpenPopup = (item) => {
        if (item.category === "Pizzas") {
            setPopupGroup(item);
            setPizzaPopupOpen(true);
        } else if (item.category === "Combo Deals") {
            if (item.name === "Pizza Combo") {
                const comboVariants = menuData.filter(m => m.name === item.name && m.category === "Combo Deals");
                setPopupGroup(comboVariants);
                setPizzaComboPopupOpen(true);
            } else if (item.name === "Detroit Combo") {

                setPopupGroup(item);
                setDetroitComboPopupOpen(true); // когда сделаем Detroit popup
            }
        } else {
            setPopupGroup(item);
            setGenericPopupOpen(true);
        }
    };

    const handleClosePizzaPopup = () => {
        setPizzaPopupOpen(false)
        setPopupGroup(null)
        setEditMode(false)
    };

    const handleClosePizzaComboPopup = () => {
        setPizzaComboPopupOpen(false)
        setPopupGroup(null)
    }

    const handleCloseDetroitComboPopup = () => {
        setDetroitComboPopupOpen(false)
        setPopupGroup(null)
        console.log(popupGroup)
    }

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

    function handleAddToCart(items, upsellDeclined) {
        console.log(items);
        const arr = Array.isArray(items) ? items : [items];

        const pizzaItem = arr.find(it => it.category === "Pizzas");
        const brickItem = arr.find(it => it.category === "Brick Pizzas");

        if (pizzaItem && !upsellDeclined) {
            const combo = menuData.find(it => it.name === "Pizza Combo" && it.size===pizzaItem.size)
            setComboOfferPhoto(combo.photo)
            setComboPrice(combo.price)
            setPendingItems(items)
            setUpsellItem(pizzaItem);
            setUpsellType("pizza");
            setUpsellPopupOpen(true);
            return;
        }

        if (brickItem && !upsellDeclined) {
            const combo = menuData.find(it => it.name === "Detroit Combo")
            setComboOfferPhoto(combo.photo)
            setComboPrice(combo.price)
            setPendingItems(items)
            setUpsellItem(brickItem);
            setUpsellType("brick");
            setUpsellPopupOpen(true);
            return;
        }

        setCartItems(prev => [
            ...prev,
            ...(Array.isArray(items) ? items : [items])
        ]);

        handleClosePizzaPopup();
        handleCloseComboPopup();
        if (items[0]) {
            window.ttq.track('AddToCart', {
                content_id: items[0].name,
                content_type: 'product',
                value: items[0].price,
                currency: 'BHD'
            });
        }

        setPendingItems(null);
    }

    function removeFromCart(name, amount, quantity) {
        setCartItems(prev =>
            prev.filter(item =>
                !(item.name === name && item.amount === amount && item.quantity === quantity)
            )
        );
    }

    function normalizeComboItem(ci) {
        return {
            name: ci?.name ?? "",
            category: ci?.category ?? "",
            size: ci?.size ?? "",
            quantity: ci?.quantity ?? 1,
            isGarlicCrust: !!ci?.isGarlicCrust,
            isThinDough: !!ci?.isThinDough,
            note: parseItemNote(ci?.description),
            extraIngredients: parseExtraIngr(ci?.description)
        };
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

    function handleChangeSize(item, newSize) {
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
                    discount_amount: parseFloat(discountAmount.toFixed(3)),
                    comboItems: item.comboItems
                        ? item.comboItems.map(ci => ({
                            name: ci.name,
                            category: ci.category,
                            size: ci.size || "",
                            quantity: ci.quantity || 1,
                            isGarlicCrust: ci.isGarlicCrust || false,
                            isThinDough: ci.isThinDough || false,
                            description: ci.description || ""
                        }))
                        : []
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
        if (!wasCrossSellShown && !isAdmin) {
            setIsCrossSellOpen(true);
            setWasCrossSellShown(true);
            return;
        }
        if (paymentMethod === null) {
            setCartOpen(false);
            if (isAdmin) {
                setAdminOrderDetailsPopUpOpen(true);
            } else setPhonePopupOpen(true);
        } else if (isAdmin && isEditMode) {
            setLoading(true);
            try {
                const orderToEdit = JSON.parse(localStorage.getItem("orderToEdit"))
                const order = buildOrderTO(orderToEdit, tel, customerName, deliveryMethod, paymentMethod, items, notes);
                console.log(order)
                await editOrder(order, orderToEdit.id);
                // await localStorage.removeItem("orderToEdit");
                const EDITED_ORDER_ID_KEY = 'editedOrderId';
                const list = [order.id];
                localStorage.setItem(EDITED_ORDER_ID_KEY, JSON.stringify(list));
                setCartOpen(false);
                navigate("/admin/");
            } catch (error) {
                console.error(error);
            } finally {
                await localStorage.removeItem("orderToEdit")
                setLoading(false);
            }
        } else {
            const order = {
                tel,
                user_id: user,
                customer_name: customerName,
                type: "Pick Up",
                payment_type: paymentMethod,
                branchNumber: 1,
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
                        discount_amount: parseFloat(discountAmount.toFixed(3)),
                        comboItems: item.comboItems
                            ? item.comboItems.map(ci => ({
                                name: ci.name,
                                category: ci.category,
                                size: ci.size || "",
                                quantity: ci.quantity || 1,
                                isGarlicCrust: ci.isGarlicCrust || false,
                                isThinDough: ci.isThinDough || false,
                                description: ci.description || ""
                            }))
                            : []
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
                    const SUPPRESS_KEY = 'suppressSoundIds';
                    const createdId = String(response.id);
                    console.log("Received id " +createdId);
                    if (createdId != null) {
                        try {
                            const list = [createdId];

                            localStorage.setItem(SUPPRESS_KEY, JSON.stringify(list));
                            console.log("LocalStorage updated with new suppressed ID: " + createdId);
                        } catch (e) {
                        }
                    }
                    setLoading(false)
                    navigate("/admin/")
                    window.ttq.identify({
                        phone_number: "+" + tel
                    });
                } else {
                    response = await createOrder(order);
                    window.ttq.track('PlaceAnOrder', {
                        content_id: "PlaceAnOrder",
                        order_id: 'id',
                        currency: 'BHD',
                        value: order.amount_paid,
                    });
                    window.ttq.identify({
                        phone_number: "+" + tel
                    });
                }
                console.log("Order placed successfully:", response);
                setCartItems([]);
            } catch (error) {
                console.error("Error placing order:", error);
            } finally {
                await localStorage.removeItem("orderToEdit")
                setPhone("")
                setUsername("")
                setCartOpen(false);
            }
        }
    }

    function handleUpsellDecline() {
        if (upsellItem) {
            handleAddToCart(pendingItems, true);
        }
        setUpsellPopupOpen(false);
        setComboOfferPhoto(null);
        setComboPrice(null);
        setUpsellItem(null);
        setUpsellType(null);
    }

    function handleUpsellAccept(item, type) {
        if (type === "pizza") {
            const pizzaCombos = menuData.filter((m) => m.name === "Pizza Combo");
            console.log(pizzaCombos);
            if (pizzaCombos.length > 0) {
                setPopupGroup(pizzaCombos);
                setPizzaComboPopupOpen(true);
            }
        } else if (type === "brick") {
            const detroitCombo = menuData.filter((m) => m.name === "Detroit Combo");
            console.log(detroitCombo);
            if (detroitCombo) {
                setPopupGroup(detroitCombo);
                setDetroitComboPopupOpen(true);
            }
        }
        setComboOfferPhoto(null);
        setComboPrice(null);
        setUpsellPopupOpen(false);
    }

    return (
        <Box sx={{backgroundColor: "#fbfaf6"}}>
            {!isAdmin && (
                <Box
                    sx={{
                        position: "relative",
                        width: "100%",
                        height: { xs: "70vh", sm: "70vh", md: "70vh" },
                        overflow: "hidden",
                        backgroundColor: "#fbfaf6",
                        mb: 0,
                    }}
                >
                    <Box
                        component="video"
                        src="/videos/header-vid.mp4"
                        autoPlay
                        muted
                        loop
                        playsInline
                        sx={{
                            position: "absolute",
                            display: "block",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            zIndex: 0
                        }}
                    />
                    <Box
                        sx={{
                            position: "absolute",
                            bottom: 0,
                            width: "100%",
                            height: "40%",
                            background: "#fbfaf6",
                            maskImage: "linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))",
                            WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))",
                            pointerEvents: "none",
                            zIndex: 1
                        }}
                    />
                    <Box
                        sx={{
                            position: "absolute",
                            bottom: 18,
                            left: 0,
                            width: "100%",
                            zIndex: 2,
                            display: "flex",
                            justifyContent: "center",
                            pointerEvents: "none",
                        }}
                    >
                        <TextTitle>BETTER THAN YOU THINK</TextTitle>
                    </Box>
                    <Box
                        sx={{
                            position: "absolute",
                            top: 16,
                            right: 16,
                            zIndex: 2,
                            display: "flex",
                            gap: 1
                        }}
                    >
                        <Fab
                            size="medium"
                            onClick={() => window.open("https://www.talabat.com/bahrain/ic-pizza", "_blank")}
                            sx={{
                                p: 0,
                                minHeight: "unset",
                                minWidth: "unset",
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                backgroundColor: "transparent",
                                boxShadow: "none",
                                "&:hover": {
                                    backgroundColor: "transparent",
                                },
                            }}
                        >
                            <Box
                                component="img"
                                src="/talabat-logo.png"
                                alt="Talabat"
                                sx={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    borderRadius: "50%",
                                    display: "block",
                                }}
                            />
                        </Fab>

                        <Fab
                            size="medium"
                            onClick={() => window.open("https://jahez.link/Sh08ob21hSb", "_blank")}
                            sx={{
                                p: 0,
                                minHeight: "unset",
                                minWidth: "unset",
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                boxShadow: "none",

                            }}
                        >
                            <Box
                                component="img"
                                src="/jahez-logo.png"
                                alt="Jahez"
                                sx={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    borderRadius: "50%",
                                    display: "block",
                                    padding: "3px"
                                }}
                            />
                        </Fab>
                    </Box>
                </Box>
            )}
            <Box sx={{ pt: 1.3, pb: 12 }}>
                {[
                    { title: "Bestsellers", items: bestsellers, isBestSellerBlock: true },
                    { title: "Detroit Brick Pizzas", items: brickPizzas },
                    { title: "Combo Deals", items: combos },
                    { title: "Pizzas", items: pizzas },
                    { title: "Sides", items: sides },
                    { title: "Sauces", items: sauces },
                    { title: "Beverages", items: beverages },
                ]
                    .filter(({ items }) => items.length > 0)
                    .map((section, idx, arr) => {
                        const isLast = idx === arr.length - 1;
                        const isBest = section.title === "Bestsellers";


                        return (
                            <Box key={section.title} sx={{ pb: isLast ? 1 : 4 }}>
                                <TextGroup sx={{ px: 1.5, pb: 1 }}>{section.title}</TextGroup>

                                <Box
                                    ref={isBest ? bestRef : null}
                                    sx={{
                                        display: "flex",
                                        overflowX: "auto",
                                        px: 1,
                                        // snap есть, но мы его временно отключаем в хуке
                                        scrollSnapType: "x mandatory",
                                        scrollBehavior: "auto",
                                        "&::-webkit-scrollbar": { display: "none" },
                                        WebkitOverflowScrolling: "touch",
                                    }}
                                >
                                    {section.items.map(group => (
                                        <Box
                                            key={group.name}
                                            sx={{ flex: "0 0 auto", scrollSnapAlign: "start", mb: 0.5}}                                     >
                                            <MenuItemCardHorizontal
                                                group={group}
                                                onSelect={handleOpenPopup}
                                                isBestSellerBlock={section.isBestSellerBlock}
                                                handleRemoveItemFromCart={handleRemoveItemFromCart}
                                                handleAddToCart={handleAddToCart}
                                                handleChangeQuantity={handleChangeQuantity}
                                                cartItems={cartItems}
                                            />
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        );
                    })}
                {/*<MenuSections*/}
                {/*    bestsellers={bestsellers}*/}
                {/*    brickPizzas={brickPizzas}*/}
                {/*    combos={combos}*/}
                {/*    pizzas={pizzas}*/}
                {/*    sides={sides}*/}
                {/*    sauces={sauces}*/}
                {/*    beverages={beverages}*/}
                {/*    handleOpenPopup={handleOpenPopup}*/}
                {/*    handleRemoveItemFromCart={handleRemoveItemFromCart}*/}
                {/*    handleAddToCart={handleAddToCart}*/}
                {/*    handleChangeQuantity={handleChangeQuantity}*/}
                {/*    cartItems={cartItems}*/}
                {/*    bestRef={bestRef}*/}
                {/*></MenuSections>*/}
            </Box>

            {!pizzaPopupOpen &&
                !comboPopupOpen &&
                !genericPopupOpen &&
                !cartOpen &&
                !phonePopupOpen &&
                !adminOrderDetailsPopUp &&
                isAdmin &&
                !pizzaComboPopupOpen &&
                !detroitComboPopupOpen &&
                !upsellPopupOpen && (
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

            {pizzaComboPopupOpen && (
                <PizzaComboPopup
                    open={true}
                    onClose={handleClosePizzaComboPopup}
                    comboGroup={popupGroup}
                    extraIngredients={extraIngredients}
                    pizzas={pizzas}
                    drinks={beverages}
                    sauces={sauces}
                    onAddToCart={handleAddToCart}
                    selectedPizza={upsellItem}
                />
            )}

            {detroitComboPopupOpen && (
                <DetroitComboPopup
                open={true}
                onClose={handleCloseDetroitComboPopup}
                combo={popupGroup}
                bricks={brickPizzas}
                drinks={beverages}
                sauces={sauces}
                onAddToCart={handleAddToCart}
                selectedDetroitPizza={upsellItem}
                >
                </DetroitComboPopup>
            )}

            {upsellPopupOpen && (
                <UpsellPopup
                open={true}
                upsellItem={upsellItem}
                upsellType={upsellType}
                onAccept={handleUpsellAccept}
                onDecline={handleUpsellDecline}
                photo={comboOfferPhoto}
                comboPrice={comboPrice}>
                </UpsellPopup>
            )}

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
                menuData={menuData}
            />
            }

            {closedPopup && (
                <ClosedPopup open={closedPopup} onClose={() => setClosedPopupOpen(false)} />
            )}

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

            {!isAdmin && showOrderConfirmed && (
                    <OrderConfirmed open={true} onClose={() => setShowOrderConfirmed(false)}/>
                )}

            {!adminOrderDetailsPopUp && !phonePopupOpen && !cartOpen && !pizzaPopupOpen && !genericPopupOpen && !comboPopupOpen && !closedPopup && !pizzaComboPopupOpen && !detroitComboPopupOpen && !upsellPopupOpen && cartItems.length > 0 &&
            <Box
                onClick={handleOpenCart}
                sx={{
                    position: "fixed",
                    bottom: 24,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "70vw",
                    maxWidth: 400,
                    zIndex: 9999,
                    px: 3,
                    py: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderRadius: 999,
                    backdropFilter: "blur(8px)",
                    backgroundColor: "rgba(255, 255, 255, 0.7)",
                    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                    cursor: "pointer",
                    transition: "background-color 0.3s",
                    "&:hover": {
                        backgroundColor: "rgba(255, 255, 255, 0.8)",
                    },
                }}
            >
                {totalPrice && totalPrice !== 0 && <Box sx={{ flexGrow: 1, textAlign: "center" }}>
                    <TextButton sx={{ fontWeight: 600, color: "#000", fontSize: "1.1rem" }}>
                        {totalPrice} BHD
                    </TextButton>
                </Box>}

                <Badge
                    badgeContent={cartItems.length}
                    color="error"
                    sx={{
                        "& .MuiBadge-badge": {
                            fontSize: "12px",
                            height: "22px",
                            minWidth: "22px",
                            backgroundColor: brandRed,
                            color: "white",
                            top: 2,
                            right: 2,
                        },
                    }}
                >
                    <ShoppingCartIcon sx={{ color: brandRed, fontSize: 32 }} />
                </Badge>
            </Box>
            }
        </Box>
    );
}

export default HomePage;
