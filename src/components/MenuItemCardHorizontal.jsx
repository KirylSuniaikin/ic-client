import React, {useEffect} from 'react';
import {
    Box,
    Card,
    CardActionArea,
    CardMedia,
    CardContent,
    Typography,
    Chip,
} from '@mui/material';

function MenuItemCardHorizontal({ group, onSelect, isBestSellerBlock }) {
    if (!group || !group.items || group.items.length === 0) {
        console.error("Invalid group passed to MenuItemCardHorizontal:", group);
        return null;
    }

    const defaultItem = group.items[0];
    const { category, name, description, price, photo, isBestSeller } = defaultItem;
    const displayPrice = ["Pizzas", "Combo Deals"].includes(category)
        ? `from ${price}`
        : `${price}`;

    // Brand colors
    const colorRed = '#E44B4C';
    const colorBeige = '#FCF4DD';

    const handleClick = () => {
        if (onSelect) {
            onSelect(group);
        }
    };

    return (
        <Card
            elevation={0}
            sx={{
                display: 'flex',
                alignItems: 'center',
                borderRadius: 0,
                borderBottom: '1px solid #ddd',
                mb: 2,
            }}
            onClick={handleClick}
        >
            <CardActionArea
                sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    p: 2
                }}
            >
                {/* Image container with 'BEST SELLER' chip */}
                <Box sx={{ position: 'relative', width: 120, height: 120, mr: 2 }}>
                    <CardMedia
                        component="img"
                        image={photo}
                        alt={name}
                        sx={{
                            width: 120,
                            height: 120,
                            objectFit: 'cover',
                        }}
                    />
                    {category === 'Brick Pizzas' && (
                        <Chip
                            label="New"
                            size="medium"
                            sx={{
                                position: 'absolute',
                                top: 4,
                                right: 8,
                                backgroundColor: colorRed,
                                color: '#fff',
                                fontWeight: 'bold',
                                fontSize: '10px',
                                py: 0.2,
                                px: 0.5,
                                borderRadius: 4,
                                height: 18,
                                width: 32,
                                '.MuiChip-label': {
                                    p: 0,
                                    lineHeight: '24px'
                                }
                            }}
                        />
                    )}
                    {!isBestSellerBlock && isBestSeller && (
                        <Chip
                            label="BEST SELLER"
                            size="small"
                            sx={{
                                position: 'absolute',
                                top: 4,
                                right: 8,
                                backgroundColor: colorRed,
                                color: '#fff',
                                fontWeight: 'bold',
                                fontSize: '8px',
                                py: 0.2,
                                px: 0.5,
                                borderRadius: 4,
                                height: 18,
                                '.MuiChip-label': {
                                    p: 0,
                                    lineHeight: '18px'
                                }
                            }}
                        />
                    )}
                </Box>

                {/* Text content */}
                <CardContent sx={{ p: 0, flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
                        {name}
                    </Typography>

                    {/* Limit description to 3 lines */}
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            mb: 1,
                            lineHeight: 1.4,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {description}
                    </Typography>

                    {/* Price pill */}
                    <Box
                        sx={{
                            display: 'inline-block',
                            backgroundColor: colorBeige,
                            color: colorRed,
                            px: 2,
                            py: 0.5,
                            borderRadius: 4,
                            fontWeight: 'bold',
                            fontSize: '14px',
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                        }}
                    >
                        {displayPrice}
                    </Box>
                </CardContent>
            </CardActionArea>
        </Card>
    );
}

export default MenuItemCardHorizontal;