import React, { useEffect, useState } from "react";
import { Box, Typography, Switch, Button, Fab } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PizzaLoader from "../loadingAnimations/PizzaLoader";
import {fetchBaseAppInfo, updateAvailability} from "../api/api";
import {groupItemsByName} from "../utils/menu_service";

const brandRed = "#E44B4C";

function ConfigComponent({ isOpen, onClose }) {
    const [isLoading, setIsLoading] = useState(false)
    const [groups, setGroups] = useState([]);
    const [originalGroups, setOriginalGroups] = useState([]);
    const [originalDough, setOriginalDough] = useState({});
    const [changes, setChanges] = useState([]);
    const [isChanged, setIsChanged] = useState(false)
    const isSaveDisabled = changes.length === 0;
    const [doughAvailability, setDoughAvailability] = useState({
        S: true,
        M: true,
        L: true,
        "Brick dough": true
    });

    useEffect(() => {
        async function load() {
            setIsLoading(true);
            try {
                const baseInfo = await fetchBaseAppInfo(null);

                function groupItemsByName(data) {
                    const map = new Map();

                    data.forEach(item => {
                        if (!map.has(item.name)) {
                            map.set(item.name, {
                                name: item.name,
                                category: item.category,
                                is_best_seller: item.is_best_seller,
                                items: []
                            });
                        }
                        map.get(item.name).items.push(item);
                    });

                    const groups = Array.from(map.values()).filter(group => group.items.length > 0);

                    const categoryOrder = [
                        "Pizzas",
                        "Brick Pizzas",
                        "Combo Deals",
                        "Sides",
                        "Beverages",
                        "Sauces"
                    ];

                    groups.sort((a, b) => {
                        const indexA = categoryOrder.indexOf(a.category);
                        const indexB = categoryOrder.indexOf(b.category);
                        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                    });

                    return groups;
                }

                const grouped = groupItemsByName(baseInfo.menu);

                let sizesAvailable = { S: false, M: false, L: false, "Brick dough": false };
                const pizzaGroups = grouped.filter(g => g.category === "Pizzas");

                ["S", "M", "L"].forEach(size => {
                    const hasAvailable = pizzaGroups.some(group =>
                        group.items.some(item => item.size === size && item.available)
                    );
                    sizesAvailable[size] = hasAvailable;
                });

                const hasBrick = grouped
                    .filter(g => g.category === "Brick Pizzas")
                    .some(group => group.items.some(item => item.available));
                sizesAvailable["Brick dough"] = hasBrick;

                const initializedGroups = grouped.map(group => ({
                    ...group,
                    enabled: group.items.some(item => item.available)
                }));

                setGroups(initializedGroups);
                setOriginalGroups(initializedGroups);
                setDoughAvailability(sizesAvailable);
                setOriginalDough(sizesAvailable);

            } catch (e) {
                console.error("Error loading menu info", e);
            } finally {
                setIsLoading(false);
            }
        }

        load();
    }, []);

    const handleToggleGroup = (name) => {
        setGroups(prevGroups => {
            const newGroups = prevGroups.map(group =>
                group.name === name ? { ...group, enabled: !group.enabled } : group
            );

            const original = originalGroups.find(g => g.name === name);
            const updated = newGroups.find(g => g.name === name);

            setChanges(prev => {
                const filtered = prev.filter(c => !(c.type === 'group' && c.name === name));

                if (original && original.enabled !== updated.enabled) {
                    return [...filtered, { type: 'group', name, enabled: updated.enabled }];
                }
                return filtered;
            });

            return newGroups;
        });
    };

    const handleToggleDough = (size) => {
        setDoughAvailability(prev => {
            const newStatus = !prev[size];

            setChanges(prevChanges => {
                const filtered = prevChanges.filter(c => !(c.type === 'dough' && c.name === size));

                if (originalDough[size] !== newStatus) {
                    return [...filtered, { type: 'dough', name: size, enabled: newStatus }];
                }
                return filtered;
            });

            return {
                ...prev,
                [size]: newStatus
            };
        });
    };

    const handleSave = () => {
        console.log("Saving only these changes:", changes);
        updateAvailability(changes).then(r => {
            setOriginalGroups(groups);
            setOriginalDough(doughAvailability);
            setChanges([]);
            onClose()
        })
    };

    if (isLoading) return <PizzaLoader/>;

    return (
        <Box sx={{ p: 0, position: "relative", height: "100vh", display: "flex", flexDirection: "column" }}>
            <Fab
                color="primary"
                aria-label="close"
                onClick={onClose}
                sx={{
                    position: 'fixed',
                    top: 16,
                    right: 16,
                    backgroundColor: brandRed,
                    color: "white",
                    '&:hover': {
                        backgroundColor: '#d23c3d',
                    },
                }}
            >
                <CloseIcon sx={{ fontSize: 30 }} />
            </Fab>

            <Box
                sx={{
                    flex: 1,
                    overflowY: "auto",
                    p: 2,
                    pb: 0,
                    "&::-webkit-scrollbar": {
                        display: "none"
                    }
                }}
            >
                <Typography variant="h5" sx={{ mt: 1, mb: 2, fontWeight: "bold" }}>
                    Dough Availability
                </Typography>
                {Object.entries(doughAvailability).map(([size, enabled]) => (
                    <Box
                        key={size}
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: "1px solid #eee",
                            py: 1,
                        }}
                    >
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {size}
                        </Typography>
                        <Switch
                            checked={enabled}
                            onChange={() => handleToggleDough(size)}
                            color="primary"
                        />
                    </Box>
                ))}
                <Typography variant="h5" sx={{ mt: 4, mb: 2, fontWeight: "bold" }}>
                    Menu Availability
                </Typography>
                {groups.map(group => (
                    <Box
                        key={group.name}
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: "1px solid #eee",
                            py: 1,
                        }}
                    >
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {group.name}
                        </Typography>
                        <Switch
                            checked={group.enabled}
                            onChange={() => handleToggleGroup(group.name)}
                            color="primary"
                        />
                    </Box>
                ))}
            </Box>

            {/* Fixed Save button at the bottom */}
            <Box
                sx={{
                    borderTop: "1px solid #eee",
                    p: 2,
                }}
            >
                <Button
                    variant="contained"
                    fullWidth
                    disabled={isSaveDisabled}
                    onClick={handleSave}
                    sx={{
                        backgroundColor: isSaveDisabled ? "#ccc" : brandRed,
                        color: "#fff",
                        textTransform: "none",
                        fontSize: "20px",
                        borderRadius: 8,
                        height: "100%",
                        "&:hover": {
                            backgroundColor: isSaveDisabled ? "#ccc" : "#d23c3d"
                        }
                    }}
                >
                    Save
                </Button>
            </Box>
        </Box>
    );
}

export default ConfigComponent;