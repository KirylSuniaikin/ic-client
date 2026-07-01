import { logger } from "../../../../shared/utils/logger";
import React, {useEffect, useState} from "react";
import {Box, Typography, Switch, Button, ToggleButton, ToggleButtonGroup} from "@mui/material";
import {StompSubscription} from "@stomp/stompjs";
import PizzaLoader from "../../../order-status/components/animations/PizzaLoader";
import {fetchBaseAppInfo, updateAvailability} from "../../../../shared/api/public";
import {connectSocket, socket} from "../../../../shared/api/socket";
import {ManagementTopBar} from "../../_shared/components/ManagementTopBar";
import type { MenuItem } from "../../../menu/types";
import type { AvailabilityChange } from "../../../order/types";
import {isDoughAlert} from "../../dough/types";
import type {DoughInventory, DoughType} from "../../dough/types";
import {getDoughInventory} from "../../../../shared/api/management";
import DoughSection from "../../dough/components/DoughSection";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import {StaffRoles} from "../../../auth/types";
import ScheduleView from "./ScheduleView";

interface SelectedBranch {
    id: string;
    name?: string;
    [key: string]: unknown;
}

interface ConfigComponentProps {
    isOpen: boolean;
    onClose: () => void;
    selectedBranch: SelectedBranch;
    role: StaffRoles | null;
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

function ConfigComponent({isOpen, onClose, selectedBranch, role}: ConfigComponentProps): JSX.Element {
    const [isLoading, setIsLoading] = useState(false)
    const [groups, setGroups] = useState<MenuGroup[]>([]);
    const [originalGroups, setOriginalGroups] = useState<MenuGroup[]>([]);
    const [originalDough, setOriginalDough] = useState<DoughAvailability>({});
    const [changes, setChanges] = useState<ConfigChange[]>([]);
    const [inventoryBuffer, setInventoryBuffer] = useState<DoughInventory>({S: 0, M: 0, L: 0, Brick: 0});
    const [inventoryDirty, setInventoryDirty] = useState(false);
    const isSaveDisabled = changes.length === 0 && !inventoryDirty;
    // "Schedule" tab is only available to MANAGER and SUPER_MANAGER.
    const showScheduleToggle =
        role === StaffRoles.MANAGER || role === StaffRoles.SUPER_MANAGER;
    const [activeTab, setActiveTab] = useState<"Menu" | "Schedule">("Menu");
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
                // Read availability for the SAME branch we write to, so the switch states
                // reflect what saving will actually change.
                const [baseInfo, inventory] = await Promise.all([
                    fetchBaseAppInfo(null, selectedBranch.id),
                    getDoughInventory(selectedBranch.id),
                ]);

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
                setInventoryBuffer(inventory);

            } catch (e) {
                logger.error("Error loading menu info", e);
            } finally {
                setIsLoading(false);
            }
        }

        void load();
    }, [selectedBranch.id]);

    // useEffect(() => {
    //     const branchId = selectedBranch.id;
    //     if (!branchId) return;
    //
    //     let sub: StompSubscription | undefined;
    //
    //     const doSubscribe = (): void => {
    //         sub = );
    //     };
    //
    //     // If the shared socket is already connected, subscribe directly to avoid overwriting
    //     // AdminHomePage's onConnect handler. Fall back to connectSocket for the disconnected case.
    //     if (socket.connected) {
    //         doSubscribe();
    //     } else {
    //         connectSocket(doSubscribe);
    //     }
    //
    //     return () => {
    //         sub?.unsubscribe();
    //     };
    // }, [selectedBranch.id]);

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

    const handleInventoryChange = (type: DoughType, value: number): void => {
        setInventoryBuffer(prev => ({...prev, [type]: value}));
        setInventoryDirty(true);
    };

    const handleSave = (): void => {
        // ConfigChange[] is passed as AvailabilityChange[] — the backend accepts both shapes
        // The types differ because the API was designed before this change tracking was introduced
        updateAvailability(
            changes as unknown as AvailabilityChange[],
            selectedBranch.id,
            inventoryDirty ? inventoryBuffer : undefined
        ).then(() => {
            setOriginalGroups(groups);
            setOriginalDough(doughAvailability);
            setChanges([]);
            setInventoryDirty(false);
            onClose();
        });
    };

    if (isLoading) return <PizzaLoader/>;

    return (
        <Box sx={{height: "100dvh", display: "flex", flexDirection: "column", backgroundColor: "#fbfaf6" }}>

            <ManagementTopBar title="Config" onBack={onClose} />

            {/* Toggle between Menu and Schedule tabs — only visible to MANAGER/SUPER_MANAGER */}
            {showScheduleToggle && (
                <Box sx={{
                    px: 1, pt: 2, pb: 1,
                    flexShrink: 0,
                    backgroundColor: "#fbfaf6",
                    overflowX: 'auto',
                    whiteSpace: 'nowrap'
                }}>
                    <ToggleButtonGroup
                        exclusive
                        value={activeTab}
                        // MUI types ToggleButtonGroup's onChange value as `any`; the buttons only
                        // emit "Menu" | "Schedule", so we narrow it back at this boundary.
                        onChange={(_, v) => v && setActiveTab(v as "Menu" | "Schedule")}
                        size="small"
                        sx={{
                            columnGap: 1,
                            '& .MuiToggleButtonGroup-grouped': {
                                border: '1px solid #e0e0e0',
                                borderRadius: 999,
                                margin: 0,
                                '&:not(:first-of-type)': {
                                    marginLeft: 0,
                                    borderLeft: '1px solid #e0e0e0',
                                },
                            },
                            '& .MuiToggleButton-root': {
                                textTransform: 'none',
                                px: 2,
                            },
                            '& .MuiToggleButton-root.Mui-selected': {
                                backgroundColor: '#E44B4C',
                                color: '#fff',
                                borderColor: '#E44B4C',
                                '&:hover': {backgroundColor: '#d23c3d', borderColor: '#d23c3d'},
                            },
                        }}
                    >
                        <ToggleButton value="Menu">Menu</ToggleButton>
                        <ToggleButton value="Schedule">Schedule</ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            )}

            {activeTab === "Schedule" ? (
                <Box
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        p: 2,
                        pb: 4,
                        "&::-webkit-scrollbar": { display: "none" }
                    }}
                >
                    <ScheduleView selectedBranch={selectedBranch} role={role} />
                </Box>
            ) : (
                <>
                    <Box
                        sx={{
                            flex: 1,
                            overflowY: "auto",
                            p: 2,
                            pb: 4,
                            "&::-webkit-scrollbar": { display: "none" }
                        }}
                    >
                        <DoughSection
                            branchId={selectedBranch.id}
                            inventory={inventoryBuffer}
                            availability={doughAvailability}
                            onInventoryChange={handleInventoryChange}
                            onAvailabilityToggle={handleToggleDough}
                            loading={isLoading}
                        />

                        <Typography variant="h5" sx={{ mt: 2, mb: 2, fontWeight: "bold" }}>
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
                </>
            )}
        </Box>
    );
}

export default ConfigComponent;
