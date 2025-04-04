export async function fetchMenu() {
    // const response = await fetch("https://localhost:8000/api/getAllMenuItems", {
    //     method: "GET",
    // });
    //
    // if (!response.ok) {
    //     throw new Error(`Ошибка: ${response.status}`);
    // }

    const text = "[\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Combo Deals\",\n" +
        "        \"description\": \"Get 2 Medium Pizza Of Your Choice \",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 1,\n" +
        "        \"name\": \"Family Double Feast Combo \",\n" +
        "        \"photo\": \"https://i.postimg.cc/BbfjMYxX/Family-Combo.jpg\",\n" +
        "        \"price\": 6.89,\n" +
        "        \"size\": \"Medium\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Savory pepperoni slices dance across a bed of creamy mozzarella cheese on our signature tomato sauce. A timeless classic for true pizza lovers.\",\n" +
        "        \"isBestSeller\": true,\n" +
        "        \"item_id\": 2,\n" +
        "        \"name\": \"Pepperoni \",\n" +
        "        \"photo\": \"https://i.postimg.cc/3JV4Ttpw/May-24-19.jpg\",\n" +
        "        \"price\": 2.59,\n" +
        "        \"size\": \"Small\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Savory pepperoni slices dance across a bed of creamy mozzarella cheese on our signature tomato sauce. A timeless classic for true pizza lovers.\",\n" +
        "        \"isBestSeller\": true,\n" +
        "        \"item_id\": 3,\n" +
        "        \"name\": \"Pepperoni \",\n" +
        "        \"photo\": \"https://i.postimg.cc/3JV4Ttpw/May-24-19.jpg\",\n" +
        "        \"price\": 3.79,\n" +
        "        \"size\": \"Medium\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Savory pepperoni slices dance across a bed of creamy mozzarella cheese on our signature tomato sauce. A timeless classic for true pizza lovers.\",\n" +
        "        \"isBestSeller\": true,\n" +
        "        \"item_id\": 4,\n" +
        "        \"name\": \"Pepperoni \",\n" +
        "        \"photo\": \"https://i.postimg.cc/3JV4Ttpw/May-24-19.jpg\",\n" +
        "        \"price\": 4.99,\n" +
        "        \"size\": \"Large\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Sauces\",\n" +
        "        \"description\": \"\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 5,\n" +
        "        \"name\": \"Hot Honey Sauce \",\n" +
        "        \"photo\": \"https://i.postimg.cc/pd8hzMFg/Hot-Honey-Ass.jpg\",\n" +
        "        \"price\": 0.35,\n" +
        "        \"size\": \"\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Sides\",\n" +
        "        \"description\": \"\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 6,\n" +
        "        \"name\": \"Garlic Bites\",\n" +
        "        \"photo\": \"https://i.postimg.cc/05cL7qQz/Screenshot-2025-02-21-at-12-15-Background-Removed-16.png\",\n" +
        "        \"price\": 0.79,\n" +
        "        \"size\": \"\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Beverages\",\n" +
        "        \"description\": \"\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 7,\n" +
        "        \"name\": \"Coca Cola Zero\",\n" +
        "        \"photo\": \"https://i.postimg.cc/Th8Bymv8/Cola.jpg\",\n" +
        "        \"price\": 0.45,\n" +
        "        \"size\": \"\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Combo Deals\",\n" +
        "        \"description\": \"Get 2 Medium Pizza Of Your Choice \",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 8,\n" +
        "        \"name\": \"Family Double Feast Combo \",\n" +
        "        \"photo\": \"https://i.postimg.cc/BbfjMYxX/Family-Combo.jpg\",\n" +
        "        \"price\": 8.9,\n" +
        "        \"size\": \"Large\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Freshly sliced cherry tomatoes, creamy mozzarella on a bed of our slow-simmered signature tomato sauce. A taste of Italy in every bite.\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 9,\n" +
        "        \"name\": \"Margherita \",\n" +
        "        \"photo\": \"https://i.postimg.cc/j5P5wHGK/Margarita.jpg\",\n" +
        "        \"price\": 2.39,\n" +
        "        \"size\": \"Small\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Freshly sliced cherry tomatoes, creamy mozzarella on a bed of our slow-simmered signature tomato sauce. A taste of Italy in every bite.\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 10,\n" +
        "        \"name\": \"Margherita \",\n" +
        "        \"photo\": \"https://i.postimg.cc/j5P5wHGK/Margarita.jpg\",\n" +
        "        \"price\": 3.39,\n" +
        "        \"size\": \"Medium\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Freshly sliced cherry tomatoes, creamy mozzarella on a bed of our slow-simmered signature tomato sauce. A taste of Italy in every bite.\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 11,\n" +
        "        \"name\": \"Margherita \",\n" +
        "        \"photo\": \"https://i.postimg.cc/j5P5wHGK/Margarita.jpg\",\n" +
        "        \"price\": 4.79,\n" +
        "        \"size\": \"Large\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Juicy marinated chicken, sweet bell peppers, and zesty onions sit atop our signature marinara sauce, finished with a smoky BBQ drizzle and our signature, creamy ranch sauce. \\nA smoky, tangy delight that’s packed with flavor\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 12,\n" +
        "        \"name\": \"BBQ Chicken Ranch \",\n" +
        "        \"photo\": \"https://i.postimg.cc/sxK37wKF/BBQ.jpg\",\n" +
        "        \"price\": 2.59,\n" +
        "        \"size\": \"Small\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Juicy marinated chicken, sweet bell peppers, and zesty onions sit atop our signature marinara sauce, finished with a smoky BBQ drizzle and our signature, creamy ranch sauce. \\nA smoky, tangy delight that’s packed with flavor\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 13,\n" +
        "        \"name\": \"BBQ Chicken Ranch \",\n" +
        "        \"photo\": \"https://i.postimg.cc/sxK37wKF/BBQ.jpg\",\n" +
        "        \"price\": 3.79,\n" +
        "        \"size\": \"Medium\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Juicy marinated chicken, sweet bell peppers, and zesty onions sit atop our signature marinara sauce, finished with a smoky BBQ drizzle and our signature, creamy ranch sauce. \\nA smoky, tangy delight that’s packed with flavor\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 14,\n" +
        "        \"name\": \"BBQ Chicken Ranch \",\n" +
        "        \"photo\": \"https://i.postimg.cc/sxK37wKF/BBQ.jpg\",\n" +
        "        \"price\": 4.99,\n" +
        "        \"size\": \"Large\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Juicy turkey, earthy mushrooms, & creamy mozzarella dance on our signature sauce. A satisfying symphony of flavors.\",\n" +
        "        \"isBestSeller\": true,\n" +
        "        \"item_id\": 15,\n" +
        "        \"name\": \"Smoked Turkey And Mushroom \",\n" +
        "        \"photo\": \"https://i.postimg.cc/HW3mSv0R/Who-Want-Smoke.jpg\",\n" +
        "        \"price\": 2.59,\n" +
        "        \"size\": \"Small\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Juicy turkey, earthy mushrooms, & creamy mozzarella dance on our signature sauce. A satisfying symphony of flavors.\",\n" +
        "        \"isBestSeller\": true,\n" +
        "        \"item_id\": 16,\n" +
        "        \"name\": \"Smoked Turkey And Mushroom \",\n" +
        "        \"photo\": \"https://i.postimg.cc/HW3mSv0R/Who-Want-Smoke.jpg\",\n" +
        "        \"price\": 3.79,\n" +
        "        \"size\": \"Medium\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Juicy turkey, earthy mushrooms, & creamy mozzarella dance on our signature sauce. A satisfying symphony of flavors.\",\n" +
        "        \"isBestSeller\": true,\n" +
        "        \"item_id\": 17,\n" +
        "        \"name\": \"Smoked Turkey And Mushroom \",\n" +
        "        \"photo\": \"https://i.postimg.cc/HW3mSv0R/Who-Want-Smoke.jpg\",\n" +
        "        \"price\": 4.99,\n" +
        "        \"size\": \"Large\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"A cheese lover's paradise! Our Four Cheese pizza is a creamy medley of mozzarella, sharp cheddar, tangy Danish blue, and salty feta on our signature sauce topped with béchamel sauce.\",\n" +
        "        \"isBestSeller\": true,\n" +
        "        \"item_id\": 18,\n" +
        "        \"name\": \"Four Cheese \",\n" +
        "        \"photo\": \"https://i.postimg.cc/d0Mc7bvk/Four-Aboba.jpg\",\n" +
        "        \"price\": 2.59,\n" +
        "        \"size\": \"Small\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"A cheese lover's paradise! Our Four Cheese pizza is a creamy medley of mozzarella, sharp cheddar, tangy Danish blue, and salty feta on our signature sauce topped with béchamel sauce.\",\n" +
        "        \"isBestSeller\": true,\n" +
        "        \"item_id\": 19,\n" +
        "        \"name\": \"Four Cheese \",\n" +
        "        \"photo\": \"https://i.postimg.cc/d0Mc7bvk/Four-Aboba.jpg\",\n" +
        "        \"price\": 3.79,\n" +
        "        \"size\": \"Medium\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"A cheese lover's paradise! Our Four Cheese pizza is a creamy medley of mozzarella, sharp cheddar, tangy Danish blue, and salty feta on our signature sauce topped with béchamel sauce.\",\n" +
        "        \"isBestSeller\": true,\n" +
        "        \"item_id\": 20,\n" +
        "        \"name\": \"Four Cheese \",\n" +
        "        \"photo\": \"https://i.postimg.cc/d0Mc7bvk/Four-Aboba.jpg\",\n" +
        "        \"price\": 4.99,\n" +
        "        \"size\": \"Large\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Embark On A Culinary Adventure With Our Seafood Pizza, Crafted With The Freshest Ingredients To Tantalize Your Taste Buds. Delight In The Creamy Richness Of Our Signature Sauce, Perfectly Paired With Gooey Mozzarella Cheese Followed By The Dive Into The Gulf Flavors Of Succulent Shrimps, Each Bite Offering A Burst Of Maritime Flavor.\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 21,\n" +
        "        \"name\": \"Seafood \",\n" +
        "        \"photo\": \"https://i.postimg.cc/zDdmwb81/Sea-Food-Jmih.jpg\",\n" +
        "        \"price\": 2.59,\n" +
        "        \"size\": \"Small\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Embark On A Culinary Adventure With Our Seafood Pizza, Crafted With The Freshest Ingredients To Tantalize Your Taste Buds. Delight In The Creamy Richness Of Our Signature Sauce, Perfectly Paired With Gooey Mozzarella Cheese Followed By The Dive Into The Gulf Flavors Of Succulent Shrimps, Each Bite Offering A Burst Of Maritime Flavor.\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 22,\n" +
        "        \"name\": \"Seafood \",\n" +
        "        \"photo\": \"https://i.postimg.cc/zDdmwb81/Sea-Food-Jmih.jpg\",\n" +
        "        \"price\": 3.79,\n" +
        "        \"size\": \"Medium\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Embark On A Culinary Adventure With Our Seafood Pizza, Crafted With The Freshest Ingredients To Tantalize Your Taste Buds. Delight In The Creamy Richness Of Our Signature Sauce, Perfectly Paired With Gooey Mozzarella Cheese Followed By The Dive Into The Gulf Flavors Of Succulent Shrimps, Each Bite Offering A Burst Of Maritime Flavor.\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 23,\n" +
        "        \"name\": \"Seafood \",\n" +
        "        \"photo\": \"https://i.postimg.cc/zDdmwb81/Sea-Food-Jmih.jpg\",\n" +
        "        \"price\": 4.99,\n" +
        "        \"size\": \"Large\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Smoky turkey slices, sweet bell peppers, and juicy pineapple rest on a base of our signature marinara sauce, crowned with a drizzle of our tangy honey mustard sauce. A perfect balance of savory and sweet in every bite\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 24,\n" +
        "        \"name\": \"Hawaiian \",\n" +
        "        \"photo\": \"https://i.postimg.cc/ZRTgpZQR/Hawain-One.jpg\",\n" +
        "        \"price\": 2.59,\n" +
        "        \"size\": \"Small\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Smoky turkey slices, sweet bell peppers, and juicy pineapple rest on a base of our signature marinara sauce, crowned with a drizzle of our tangy honey mustard sauce. A perfect balance of savory and sweet in every bite\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 25,\n" +
        "        \"name\": \"Hawaiian \",\n" +
        "        \"photo\": \"https://i.postimg.cc/ZRTgpZQR/Hawain-One.jpg\",\n" +
        "        \"price\": 3.79,\n" +
        "        \"size\": \"Medium\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Smoky turkey slices, sweet bell peppers, and juicy pineapple rest on a base of our signature marinara sauce, crowned with a drizzle of our tangy honey mustard sauce. A perfect balance of savory and sweet in every bite\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 26,\n" +
        "        \"name\": \"Hawaiian \",\n" +
        "        \"photo\": \"https://i.postimg.cc/ZRTgpZQR/Hawain-One.jpg\",\n" +
        "        \"price\": 4.99,\n" +
        "        \"size\": \"Large\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Share the melody of flavors! Our veggie pizza bursts with vibrant bell peppers, earthy mushrooms, sweet onions, and briny olives on a bed of our signature sauce and creamy mozzarella\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 27,\n" +
        "        \"name\": \"Vegetarian \",\n" +
        "        \"photo\": \"https://i.postimg.cc/j21kpfSw/Vegeterian14.jpg\",\n" +
        "        \"price\": 2.59,\n" +
        "        \"size\": \"Small\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Share the melody of flavors! Our veggie pizza bursts with vibrant bell peppers, earthy mushrooms, sweet onions, and briny olives on a bed of our signature sauce and creamy mozzarella\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 28,\n" +
        "        \"name\": \"Vegetarian \",\n" +
        "        \"photo\": \"https://i.postimg.cc/j21kpfSw/Vegeterian14.jpg\",\n" +
        "        \"price\": 3.79,\n" +
        "        \"size\": \"Medium\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Share the melody of flavors! Our veggie pizza bursts with vibrant bell peppers, earthy mushrooms, sweet onions, and briny olives on a bed of our signature sauce and creamy mozzarella\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 29,\n" +
        "        \"name\": \"Vegetarian \",\n" +
        "        \"photo\": \"https://i.postimg.cc/j21kpfSw/Vegeterian14.jpg\",\n" +
        "        \"price\": 4.99,\n" +
        "        \"size\": \"Large\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Our Mexican Pizza is a flavor fiesta waiting to erupt on your tongue! Creamy cheese & tangy sauce tango with sweet peppers, juicy corn, and zesty onions. Cherry tomatoes add a burst of sweetness finished with a fiery jalapeño kick\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 30,\n" +
        "        \"name\": \"Mexican \",\n" +
        "        \"photo\": \"https://i.postimg.cc/nzRdmm7R/Mexican-Obama.jpg\",\n" +
        "        \"price\": 2.59,\n" +
        "        \"size\": \"Small\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Our Mexican Pizza is a flavor fiesta waiting to erupt on your tongue! Creamy cheese & tangy sauce tango with sweet peppers, juicy corn, and zesty onions. Cherry tomatoes add a burst of sweetness finished with a fiery jalapeño kick\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 31,\n" +
        "        \"name\": \"Mexican \",\n" +
        "        \"photo\": \"https://i.postimg.cc/nzRdmm7R/Mexican-Obama.jpg\",\n" +
        "        \"price\": 3.79,\n" +
        "        \"size\": \"Medium\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Pizzas\",\n" +
        "        \"description\": \"Our Mexican Pizza is a flavor fiesta waiting to erupt on your tongue! Creamy cheese & tangy sauce tango with sweet peppers, juicy corn, and zesty onions. Cherry tomatoes add a burst of sweetness finished with a fiery jalapeño kick\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 32,\n" +
        "        \"name\": \"Mexican \",\n" +
        "        \"photo\": \"https://i.postimg.cc/nzRdmm7R/Mexican-Obama.jpg\",\n" +
        "        \"price\": 4.99,\n" +
        "        \"size\": \"Large\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Sauces\",\n" +
        "        \"description\": \"\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 33,\n" +
        "        \"name\": \"Cheese Sauce\",\n" +
        "        \"photo\": \"https://i.postimg.cc/XJLvkj7D/Cheeeeeeeez.jpg\",\n" +
        "        \"price\": 0.35,\n" +
        "        \"size\": \"\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Sauces\",\n" +
        "        \"description\": \"\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 34,\n" +
        "        \"name\": \"Ranch Sauce\",\n" +
        "        \"photo\": \"https://i.postimg.cc/htRqhFKJ/Love-Sosa2.jpg\",\n" +
        "        \"price\": 0.35,\n" +
        "        \"size\": \"\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Sauces\",\n" +
        "        \"description\": \"\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 35,\n" +
        "        \"name\": \"BBQ Sauce \",\n" +
        "        \"photo\": \"https://i.postimg.cc/9XS25RSY/LoveSosa.jpg\",\n" +
        "        \"price\": 0.29,\n" +
        "        \"size\": \"\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Sauces\",\n" +
        "        \"description\": \"\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 36,\n" +
        "        \"name\": \"Honey Mustard Sauce\",\n" +
        "        \"photo\": \"https://i.postimg.cc/SKyF7W2k/Mustard-Honey.jpg\",\n" +
        "        \"price\": 0.35,\n" +
        "        \"size\": \"\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Beverages\",\n" +
        "        \"description\": \"\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 38,\n" +
        "        \"name\": \"7Up Diet\",\n" +
        "        \"photo\": \"https://i.postimg.cc/9QXHydqV/7up.jpg\",\n" +
        "        \"price\": 0.45,\n" +
        "        \"size\": \"\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Beverages\",\n" +
        "        \"description\": \"\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 39,\n" +
        "        \"name\": \"Fanta Orange\",\n" +
        "        \"photo\": \"https://i.postimg.cc/5N1hMBgv/Fanta.webp\",\n" +
        "        \"price\": 0.45,\n" +
        "        \"size\": \"\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Beverages\",\n" +
        "        \"description\": \"\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 37,\n" +
        "        \"name\": \"Coca Cola\",\n" +
        "        \"photo\": \"https://i.postimg.cc/h4xnnPBF/Cola.jpg\",\n" +
        "        \"price\": 0.45,\n" +
        "        \"size\": \"\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Beverages\",\n" +
        "        \"description\": \"\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 40,\n" +
        "        \"name\": \"Kinza Cola\",\n" +
        "        \"photo\": \"https://i.postimg.cc/FHC8c24g/Kinza-Cola.webp\",\n" +
        "        \"price\": 0.35,\n" +
        "        \"size\": \"\"\n" +
        "    },\n" +
        "    {\n" +
        "        \"available\": true,\n" +
        "        \"category\": \"Beverages\",\n" +
        "        \"description\": \"\",\n" +
        "        \"isBestSeller\": false,\n" +
        "        \"item_id\": 41,\n" +
        "        \"name\": \"Water\",\n" +
        "        \"photo\": \"https://i.postimg.cc/kGCpqCQ9/Wodichka.jpg\",\n" +
        "        \"price\": 0.2,\n" +
        "        \"size\": \"\"\n" +
        "    }\n" +
        "]";
    if (text.trim().startsWith("<!DOCTYPE html>")) {
        throw new Error("API вернул HTML, а не JSON. Проверь сервер!");
    }

    return JSON.parse(text);
}

export async function fetchExtraIngredients() {
    const response = await fetch("https://localhost:8000/api/getAllExtraIngr", {
        method: "GET",
    });
    if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
    }

    const data = await response.json();
    return data;
}

export async function createOrder(order) {
    console.log(order);
    const response = await fetch("https://localhost:8000/api/createOrder", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(order)
    });


    if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
    }

    return await response.json();
}