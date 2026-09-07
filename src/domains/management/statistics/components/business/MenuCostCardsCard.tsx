import React, {useState} from "react";
import {
    Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, MenuItem, Select,
    Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup,
    Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type {ComponentCost, MenuCostCardsResponse, MenuItemCostCard} from "../../types";
import {formatBd} from "./businessFormat";
import {BRAND_RED} from "../../../../../shared/utils/theme";
import {StatSkeleton} from "../performance/statPlaceholders";

type Props = {
    data: MenuCostCardsResponse | null;
    loading: boolean;
    /**
     * Every component with its resolved cost. Carries the batch recipes — doughs, sauces, sauce
     * cups — which have no menu item of their own and so appear on no cost card, despite being
     * where a good deal of the cost actually is.
     */
    components: ComponentCost[];
    /** Opens the ingredient-cost drawer. The only route to it now that the setup cards are gone. */
    onSetCosts: () => void;
};

type Mode = "menu" | "batch";

/**
 * What each menu item costs to make.
 *
 * <p>The grain is a menu-item row, which is already per size — sizes are separate rows with their
 * own recipes — so no size dimension is invented.
 *
 * <p>Every line prints its <em>resolved unit cost</em> beside the amount. That is the only place a
 * per-kilogram price mistakenly read as per-gram becomes visible: in a total it is just a number,
 * but a gram of mozzarella at 2.500 BD is obviously wrong.
 */
export default function MenuCostCardsCard(
    {data, loading, components, onSetCosts}: Props
): React.JSX.Element {
    const [mode, setMode] = useState<Mode>("menu");
    const [category, setCategory] = useState<string>("");
    const [search, setSearch] = useState<string>("");

    if (loading && data === null) {
        return <StatSkeleton lines={5}/>;
    }

    if (data === null) {
        return (
            <Typography variant="body2" sx={{color: '#8a807a'}}>
                Cost cards could not be loaded.
            </Typography>
        );
    }

    const categories = Array.from(new Set(data.cards.map(c => c.category).filter(Boolean))) as string[];
    const visible = data.cards.filter(c =>
        (category === "" || c.category === category)
        && (search === "" || c.name.toLowerCase().includes(search.toLowerCase())));

    const renderCard = (card: MenuItemCostCard): React.JSX.Element => (
        <Accordion key={card.menuItemId} disableGutters
                   sx={{boxShadow: 'none', border: '1px solid #f1eae4', borderRadius: 2, mb: 1, '&:before': {display: 'none'}}}>
            <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', width: '100%'}}>
                    <Typography fontWeight="bold">{card.name}</Typography>
                    {card.size && <Chip size="small" label={card.size} sx={{backgroundColor: '#f1eae4'}}/>}
                    {!card.complete && (
                        // An incomplete card understates cost and therefore overstates margin, so it
                        // must not read as authoritative.
                        <Chip size="small" label="Incomplete" color="warning"/>
                    )}
                    <Typography variant="body2" sx={{color: '#8a807a', ml: 'auto', whiteSpace: 'nowrap'}}>
                        {formatBd(card.totalCost)} cost · {card.foodCostPercent === null
                        ? "—" : `${card.foodCostPercent.toFixed(1)}%`} food cost
                    </Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{fontWeight: 'bold'}}>Ingredient</TableCell>
                            <TableCell align="right" sx={{fontWeight: 'bold'}}>Amount</TableCell>
                            <TableCell align="right" sx={{fontWeight: 'bold'}}>Unit cost</TableCell>
                            <TableCell align="right" sx={{fontWeight: 'bold'}}>Cost</TableCell>
                            <TableCell sx={{fontWeight: 'bold'}}>Source</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {card.lines.map(line => (
                            <TableRow key={line.componentId}>
                                <TableCell>{line.componentName}</TableCell>
                                <TableCell align="right">{line.amount} {line.unit?.toLowerCase()}</TableCell>
                                <TableCell align="right">{line.unitCost}</TableCell>
                                <TableCell align="right">{formatBd(line.lineCost)}</TableCell>
                                <TableCell>
                                    <Chip
                                        size="small"
                                        label={line.costSource}
                                        color={line.costSource === "MISSING" ? "warning" : "default"}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                        <TableRow>
                            <TableCell sx={{fontWeight: 'bold'}}>Total cost</TableCell>
                            <TableCell/><TableCell/>
                            <TableCell align="right" sx={{fontWeight: 'bold'}}>{formatBd(card.totalCost)}</TableCell>
                            <TableCell/>
                        </TableRow>
                        <TableRow>
                            <TableCell>Sale price</TableCell>
                            <TableCell/><TableCell/>
                            <TableCell align="right">{formatBd(card.salePrice)}</TableCell>
                            <TableCell/>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{fontWeight: 'bold'}}>Gross profit</TableCell>
                            <TableCell/><TableCell/>
                            <TableCell align="right" sx={{fontWeight: 'bold'}}>{formatBd(card.grossProfit)}</TableCell>
                            <TableCell/>
                        </TableRow>
                    </TableBody>
                </Table>
            </AccordionDetails>
        </Accordion>
    );

    /**
     * A batch recipe, laid out exactly like a cost card so the two read the same way.
     *
     * <p>No sale price and so no food-cost %: a dough is not sold, it is consumed by the items that
     * are. What it does have is a YIELD, and the cost per kg that falls out of it — which is the
     * number that actually reaches every pizza on the other tab.
     */
    const renderBatch = (c: ComponentCost): React.JSX.Element => {
        const perKg = c.unit === "GRAMS" || c.unit === "ML";
        const batchCost = c.ingredients.reduce((sum, l) => sum + l.lineCost, 0);

        return (
            <Accordion key={c.id} disableGutters
                       sx={{boxShadow: 'none', border: '1px solid #f1eae4', borderRadius: 2, mb: 1, '&:before': {display: 'none'}}}>
                <AccordionSummary expandIcon={<ExpandMoreIcon/>}>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', width: '100%'}}>
                        <Typography fontWeight="bold">{c.name}</Typography>
                        {c.batchYield !== null && (
                            <Chip size="small" label={`yields ${c.batchYield} ${c.unit?.toLowerCase() ?? ""}`}
                                  sx={{backgroundColor: '#f1eae4'}}/>
                        )}
                        {c.ingredients.some(l => l.lineCost === 0) && (
                            // A zero line means an ingredient with no cost, which drags the whole
                            // batch down and every recipe that uses it with it.
                            <Chip size="small" label="Incomplete" color="warning"/>
                        )}
                        <Typography variant="body2" sx={{color: '#8a807a', ml: 'auto', whiteSpace: 'nowrap'}}>
                            {formatBd(perKg ? c.resolvedUnitCost * 1000 : c.resolvedUnitCost)}
                            {perKg ? " per kg" : " each"}
                        </Typography>
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{fontWeight: 'bold'}}>Ingredient</TableCell>
                                <TableCell align="right" sx={{fontWeight: 'bold'}}>Amount</TableCell>
                                <TableCell align="right" sx={{fontWeight: 'bold'}}>Cost</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {c.ingredients.map(line => (
                                <TableRow key={line.id}>
                                    <TableCell>
                                        {line.ingredientProductName ?? line.ingredientComponentName}
                                        {line.ingredientComponentName && (
                                            // A batch inside a batch. Worth marking: it is the one
                                            // place a cost can move without this recipe changing.
                                            <Chip size="small" label="batch" sx={{ml: 1, backgroundColor: '#f1eae4'}}/>
                                        )}
                                    </TableCell>
                                    <TableCell align="right">{line.amount}</TableCell>
                                    <TableCell align="right">{formatBd(line.lineCost)}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow>
                                <TableCell sx={{fontWeight: 'bold'}}>Batch cost</TableCell>
                                <TableCell/>
                                <TableCell align="right" sx={{fontWeight: 'bold'}}>{formatBd(batchCost)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </AccordionDetails>
            </Accordion>
        );
    };

    // Only components that are actually made from something. A component linked straight to a
    // purchased product is not a recipe, it is a price.
    const batches = components
        .filter(c => c.ingredients.length > 0)
        .filter(c => search === "" || c.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <>
            {data.costing.componentsResolved < data.costing.componentsUsed && (
                <Alert severity="warning" sx={{mb: 2, borderRadius: 2}}>
                    {data.costing.componentsUsed - data.costing.componentsResolved} of{" "}
                    {data.costing.componentsUsed} ingredients have no cost
                    ({data.costing.coveragePercent}% covered), so these cards understate cost and
                    overstate margin.
                </Alert>
            )}

            {data.menuItemsWithoutRecipe.length > 0 && (
                <Alert severity="info" sx={{mb: 2, borderRadius: 2}}>
                    {data.menuItemsWithoutRecipe.length} menu item
                    {data.menuItemsWithoutRecipe.length === 1 ? " has" : "s have"} no recipe at
                    all, so {data.menuItemsWithoutRecipe.length === 1 ? "it cannot" : "they cannot"} be
                    costed: {data.menuItemsWithoutRecipe.slice(0, 5).map(i => i.name).join(", ")}
                    {data.menuItemsWithoutRecipe.length > 5 ? "…" : ""}
                </Alert>
            )}

            <Box sx={{display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center'}}>
                {/* Same pill group as the Statistics tab strip above, so the two read as one
                    control system rather than two. */}
                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={mode}
                    onChange={(_, v: Mode | null) => v && setMode(v)}
                    sx={{
                        columnGap: 1,
                        '& .MuiToggleButtonGroup-grouped': {
                            border: '1px solid #e0e0e0',
                            borderRadius: 999,
                            margin: 0,
                            '&:not(:first-of-type)': {marginLeft: 0, borderLeft: '1px solid #e0e0e0'},
                        },
                        '& .MuiToggleButton-root': {textTransform: 'none', px: 2},
                        '& .MuiToggleButton-root.Mui-selected': {
                            backgroundColor: BRAND_RED,
                            color: '#fff',
                            borderColor: BRAND_RED,
                            '&:hover': {backgroundColor: '#d23c3d', borderColor: '#d23c3d'},
                        },
                    }}
                >
                    <ToggleButton value="menu">Menu items</ToggleButton>
                    <ToggleButton value="batch">Batch recipes</ToggleButton>
                </ToggleButtonGroup>

                {/* Categories only exist for menu items; a dough has none. */}
                {mode === "menu" && (
                    <Select
                        size="small"
                        displayEmpty
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        sx={{
                            minWidth: 160,
                            borderRadius: 999,
                            '& .MuiOutlinedInput-notchedOutline': {borderColor: '#e0e0e0'},
                            '&:hover .MuiOutlinedInput-notchedOutline': {borderColor: BRAND_RED},
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {borderColor: BRAND_RED},
                            '& .MuiSelect-select': {py: 0.75},
                        }}
                        MenuProps={{PaperProps: {sx: {borderRadius: 2, mt: 0.5, boxShadow: 6}}}}
                    >
                        <MenuItem value="">All categories</MenuItem>
                        {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                )}

                <TextField
                    size="small"
                    placeholder="Search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 999,
                            '& fieldset': {borderColor: '#e0e0e0'},
                            '&:hover fieldset': {borderColor: BRAND_RED},
                            '&.Mui-focused fieldset': {borderColor: BRAND_RED},
                        },
                    }}
                />

                <Button
                    variant="outlined"
                    size="small"
                    onClick={onSetCosts}
                    sx={{
                        ml: 'auto',
                        textTransform: 'none',
                        borderRadius: 999,
                        borderColor: '#e0e0e0',
                        color: '#3b352c',
                        '&:hover': {borderColor: BRAND_RED, color: BRAND_RED},
                    }}
                >
                    Set ingredient costs
                </Button>
            </Box>

            {mode === "batch" ? (
                batches.length === 0
                    ? <Typography variant="body2" sx={{color: '#8a807a'}}>
                        No batch recipes yet. A dough or a sauce becomes one as soon as it is given
                        ingredients and a yield in Set ingredient costs.
                      </Typography>
                    : <>{batches.map(renderBatch)}</>
            ) : visible.length === 0 ? (
                <Typography variant="body2" sx={{color: '#8a807a'}}>No matching items.</Typography>
            ) : visible.map(renderCard)}
        </>
    );
}
