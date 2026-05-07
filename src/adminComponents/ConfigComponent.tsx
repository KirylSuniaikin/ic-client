import React, {useEffect, useState} from "react";
import {Box, Typography, Switch, Button} from "@mui/material";
import PizzaLoader from "../components/loadingAnimations/PizzaLoader";
import {fetchBaseAppInfo, updateAvailability} from "../api/api";
import {BackTopBar} from "../management/consumptionComponents/BackTopBar";
import type { MenuItem } from "../management/types/menuTypes";
import type { AvailabilityChange } from "../types/orderTypes";

interface SelectedBranch {
    id: string;
    name?: string;
    [key: string]: unknown;
}

interface ConfigComponentProps {
    isOpen: boolean;
    onClose: () => void;
    selectedBranch: SelectedBranch;
}

// Internal representation of a pending change before it's sent to the API
type ConfigChange = {
    type: 'group' | 'dough';
    name: string;
    enabled: boolean;
};

type MenuGroup = {
    name: string;
    category: string;
    is_best_seller: boolean;
    items: MenuItem[];
    enabled: boolean;
};

type DoughAvailability = Record<string, boolean>;

function ConfigComponent({isOpen, onClose, selectedBranch}: ConfigComponentProps): JSX.Element {
    const [isLoading, setIsLoading] = useState(false)
    const [groups, setGroups] = useState<MenuGroup[]>([]);
    const [originalGroups, setOriginalGroups] = useState<MenuGroup[]>([]);
    const [originalDough, setOriginalDough] = useState<DoughAvailability>({});
    const [changes, setChanges] = useState<ConfigChange[]>([]);
    const isSaveDisabled = changes.length === 0;
    const [doughAvailability, setDoughAvailability] = useState<DoughAvailability>({
        S: true,
        M: true,
        L: true,
        "Brick dough": true
    });

    useEffect(() => {
        async function load(): Promise<void> {
            setIsLoading(true);
            try {
                // branchId is hardcoded in the API implementation, so passing empty string here
                // does not affect the actual request behaviour
                const baseInfo = await fetchBaseAppInfo(null, '');

                function groupItemsByName(data: MenuItem[]): MenuGroup[] {
                    const map = new Map<string, MenuGroup>();

                    data.forEach(item => {
                        if (!map.has(item.name)) {
                            map.set(item.name, {
                                name: item.name,
                                category: item.category,
                                is_best_seller: item.is_best_seller,
                                items: [],
                                enabled: false
                            });
                        }
                        map.get(item.name)!.items.push(item);
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

                const sizesAvailable: DoughAvailability = {S: false, M: false, L: false, "Brick dough": false};
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

    const handleToggleGroup = (name: string): void => {
        setGroups(prevGroups => {
            const newGroups = prevGroups.map(group =>
                group.name === name ? {...group, enabled: !group.enabled} : group
            );

            const original = originalGroups.find(g => g.name === name);
            const updated = newGroups.find(g => g.name === name);

            setChanges(prev => {
                const filtered = prev.filter(c => !(c.type === 'group' && c.name === name));

                if (original && updated && original.enabled !== updated.enabled) {
                    return [...filtered, {type: 'group', name, enabled: updated.enabled}];
                }
                return filtered;
            });

            return newGroups;
        });
    };

    const handleToggleDough = (size: string): void => {
        setDoughAvailability(prev => {
            const newStatus = !prev[size];

            setChanges(prevChanges => {
                const filtered = prevChanges.filter(c => !(c.type === 'dough' && c.name === size));

                if (originalDough[size] !== newStatus) {
                    return [...filtered, {type: 'dough', name: size, enabled: newStatus}];
                }
                return filtered;
            });

            return {
                ...prev,
                [size]: newStatus
            };
        });
    };

    const handleSave = (): void => {
        // ConfigChange[] is passed as AvailabilityChange[] — the backend accepts both shapes
        // The types differ because the API was designed before this change tracking was introduced
        updateAvailability(changes as unknown as AvailabilityChange[], selectedBranch.id).then(() => {
            setOriginalGroups(groups);
            setOriginalDough(doughAvailability);
            setChanges([]);
            onClose()
        })
    };

    if (isLoading) return <PizzaLoader/>;

    return (
        <Box sx={{height: "100dvh", display: "flex", flexDirection: "column", backgroundColor: "#fbfaf6" }}>

            <BackTopBar onClose={onClose} title="Config" />

            <Box
                sx={{
                    flex: 1,
                    overflowY: "auto",
                    p: 2,
                    pb: 4,
                    "&::-webkit-scrollbar": { display: "none" }
                }}
            >
                <Typography variant="h5" sx={{ mt: 1, mb: 2, fontWeight: "bold" }}>
                    Dough Availability
                </Typography>
                {Object.entries(doughAvailability).map(([size, enabled]) => (
                    <Box key={size} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", py: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{size}</Typography>
                        <Switch checked={enabled} onChange={() => handleToggleDough(size)} color="primary" />
                    </Box>
                ))}

                <Typography variant="h5" sx={{ mt: 4, mb: 2, fontWeight: "bold" }}>
                    Menu Availability
                </Typography>
                {groups.map(group => (
                    <Box key={group.name} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", py: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{group.name}</Typography>
                        <Switch checked={group.enabled} onChange={() => handleToggleGroup(group.name)} color="primary" />
                    </Box>
                ))}
            </Box>

            <Box
                sx={{
                    p: 2,
                    backgroundColor: "#fff",
                    borderTop: "1px solid #eee",
                }}
            >
                <Button
                    onClick={handleSave}
                    variant="contained"
                    fullWidth
                    disabled={isSaveDisabled}
                    sx={{
                        backgroundColor: "#E44B4C",
                        borderRadius: "999px",
                        textTransform: "none",
                        fontWeight: "bold",
                        py: 1.25,
                        fontSize: "1rem",
                        '&:hover': {
                            backgroundColor: '#c63b3c',
                        },
                    }}>
                    Save
                </Button>
            </Box>
        </Box>
    );
}

export default ConfigComponent;
