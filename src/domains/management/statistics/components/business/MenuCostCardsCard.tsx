import React, {useState} from "react";
import {
    Accordion, AccordionDetails, AccordionSummary, Alert, Box, Card, CardContent, Chip, MenuItem,
    Select, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type {MenuCostCardsResponse, MenuItemCostCard} from "../../types";
import {formatBd} from "./businessFormat";
import {StatSkeleton} from "../performance/statPlaceholders";

type Props = {
    data: MenuCostCardsResponse | null;
    loading: boolean;
};

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
export default function MenuCostCardsCard({data, loading}: Props): React.JSX.Element {
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

            <Box sx={{display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap'}}>
                <Select
                    size="small"
                    displayEmpty
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    sx={{minWidth: 160}}
                >
                    <MenuItem value="">All categories</MenuItem>
                    {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
                <TextField
                    size="small"
                    placeholder="Search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </Box>

            {visible.length === 0 ? (
                <Typography variant="body2" sx={{color: '#8a807a'}}>No matching items.</Typography>
            ) : visible.map(renderCard)}
        </>
    );
}
