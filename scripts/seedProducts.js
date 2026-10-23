/**
 * Sample Products Seed Script
 *
 * Run this script to populate your Products collection with sample grocery items
 *
 * SETUP:
 * 1. Install node-appwrite: npm install node-appwrite
 * 2. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY,
 *    APPWRITE_DATABASE_ID in your environment (or a local .env loaded
 *    before this script runs)
 * 3. Run: node seedProducts.js
 */

const sdk = require('node-appwrite');

const client = new sdk.Client();
client
    .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const databases = new sdk.Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
const PRODUCTS_COLLECTION_ID = 'products';

// Sample grocery products
const sampleProducts = [
    // Produce
    {
        name: 'Bananas',
        category: 'produce',
        subcategory: 'Fruits',
        price: 0.59,
        unit: 'lb',
        inStock: true,
        aisle: 'A1',
        barcode: '4011'
    },
    {
        name: 'Organic Apples',
        category: 'produce',
        subcategory: 'Fruits',
        price: 2.99,
        unit: 'lb',
        inStock: true,
        aisle: 'A1'
    },
    {
        name: 'Romaine Lettuce',
        category: 'produce',
        subcategory: 'Vegetables',
        price: 2.49,
        unit: 'each',
        inStock: true,
        aisle: 'A2'
    },
    {
        name: 'Tomatoes',
        category: 'produce',
        subcategory: 'Vegetables',
        price: 1.99,
        unit: 'lb',
        inStock: true,
        aisle: 'A2'
    },
    {
        name: 'Baby Carrots',
        category: 'produce',
        subcategory: 'Vegetables',
        price: 1.49,
        unit: '1lb bag',
        inStock: true,
        aisle: 'A2'
    },

    // Dairy
    {
        name: 'Whole Milk',
        category: 'dairy',
        subcategory: 'Milk',
        price: 3.99,
        unit: 'gallon',
        inStock: true,
        aisle: 'B1'
    },
    {
        name: 'Large Eggs',
        category: 'dairy',
        subcategory: 'Eggs',
        price: 4.49,
        unit: 'dozen',
        inStock: true,
        aisle: 'B1'
    },
    {
        name: 'Cheddar Cheese',
        category: 'dairy',
        subcategory: 'Cheese',
        price: 5.99,
        unit: '8oz block',
        inStock: true,
        aisle: 'B2'
    },
    {
        name: 'Greek Yogurt',
        category: 'dairy',
        subcategory: 'Yogurt',
        price: 1.29,
        unit: '5.3oz cup',
        inStock: true,
        aisle: 'B2'
    },
    {
        name: 'Butter',
        category: 'dairy',
        subcategory: 'Butter',
        price: 4.99,
        unit: '16oz',
        inStock: true,
        aisle: 'B2'
    },

    // Meat
    {
        name: 'Ground Beef',
        category: 'meat',
        subcategory: 'Beef',
        price: 5.99,
        unit: 'lb',
        inStock: true,
        aisle: 'C1'
    },
    {
        name: 'Chicken Breast',
        category: 'meat',
        subcategory: 'Poultry',
        price: 7.99,
        unit: 'lb',
        inStock: true,
        aisle: 'C1'
    },
    {
        name: 'Salmon Fillet',
        category: 'meat',
        subcategory: 'Seafood',
        price: 12.99,
        unit: 'lb',
        inStock: true,
        aisle: 'C2'
    },

    // Bakery
    {
        name: 'Whole Wheat Bread',
        category: 'bakery',
        subcategory: 'Bread',
        price: 2.49,
        unit: 'loaf',
        inStock: true,
        aisle: 'D1'
    },
    {
        name: 'Bagels',
        category: 'bakery',
        subcategory: 'Bread',
        price: 3.99,
        unit: '6 pack',
        inStock: true,
        aisle: 'D1'
    },
    {
        name: 'Chocolate Chip Cookies',
        category: 'bakery',
        subcategory: 'Cookies',
        price: 4.49,
        unit: '12oz pack',
        inStock: true,
        aisle: 'D2'
    },

    // Frozen
    {
        name: 'Frozen Pizza',
        category: 'frozen',
        subcategory: 'Meals',
        price: 6.99,
        unit: 'each',
        inStock: true,
        aisle: 'E1'
    },
    {
        name: 'Ice Cream',
        category: 'frozen',
        subcategory: 'Desserts',
        price: 5.49,
        unit: 'pint',
        inStock: true,
        aisle: 'E2'
    },
    {
        name: 'Frozen Vegetables',
        category: 'frozen',
        subcategory: 'Vegetables',
        price: 2.99,
        unit: '16oz bag',
        inStock: true,
        aisle: 'E1'
    },

    // Pantry
    {
        name: 'Pasta',
        category: 'pantry',
        subcategory: 'Grains',
        price: 1.29,
        unit: '16oz box',
        inStock: true,
        aisle: 'F1'
    },
    {
        name: 'Rice',
        category: 'pantry',
        subcategory: 'Grains',
        price: 3.99,
        unit: '2lb bag',
        inStock: true,
        aisle: 'F1'
    },
    {
        name: 'Olive Oil',
        category: 'pantry',
        subcategory: 'Oils',
        price: 8.99,
        unit: '16oz bottle',
        inStock: true,
        aisle: 'F2'
    },
    {
        name: 'Peanut Butter',
        category: 'pantry',
        subcategory: 'Spreads',
        price: 4.49,
        unit: '16oz jar',
        inStock: true,
        aisle: 'F3'
    },
    {
        name: 'Canned Tomatoes',
        category: 'pantry',
        subcategory: 'Canned Goods',
        price: 1.99,
        unit: '14.5oz can',
        inStock: true,
        aisle: 'F3'
    },

    // Beverages
    {
        name: 'Orange Juice',
        category: 'beverages',
        subcategory: 'Juice',
        price: 4.49,
        unit: '64oz',
        inStock: true,
        aisle: 'G1'
    },
    {
        name: 'Coffee',
        category: 'beverages',
        subcategory: 'Coffee',
        price: 9.99,
        unit: '12oz bag',
        inStock: true,
        aisle: 'G2'
    },
    {
        name: 'Bottled Water',
        category: 'beverages',
        subcategory: 'Water',
        price: 5.99,
        unit: '24 pack',
        inStock: true,
        aisle: 'G3'
    },
    {
        name: 'Soda',
        category: 'beverages',
        subcategory: 'Soft Drinks',
        price: 6.99,
        unit: '12 pack',
        inStock: true,
        aisle: 'G3'
    },

    // Snacks
    {
        name: 'Potato Chips',
        category: 'snacks',
        subcategory: 'Chips',
        price: 3.99,
        unit: '8oz bag',
        inStock: true,
        aisle: 'H1'
    },
    {
        name: 'Pretzels',
        category: 'snacks',
        subcategory: 'Pretzels',
        price: 2.99,
        unit: '10oz bag',
        inStock: true,
        aisle: 'H1'
    },
    {
        name: 'Granola Bars',
        category: 'snacks',
        subcategory: 'Bars',
        price: 4.99,
        unit: '6 pack',
        inStock: true,
        aisle: 'H2'
    },

    // --- Catalog expansion ---
    { name: "Avocados", category: "produce", subcategory: "Fruits", price: 1.29, unit: "each", inStock: true, aisle: "A1" },
    { name: "Strawberries", category: "produce", subcategory: "Fruits", price: 4.49, unit: "1lb pack", inStock: true, aisle: "A1" },
    { name: "Blueberries", category: "produce", subcategory: "Fruits", price: 3.99, unit: "6oz pack", inStock: true, aisle: "A1" },
    { name: "Lemons", category: "produce", subcategory: "Fruits", price: 0.79, unit: "each", inStock: true, aisle: "A1" },
    { name: "Broccoli", category: "produce", subcategory: "Vegetables", price: 2.29, unit: "lb", inStock: true, aisle: "A2" },
    { name: "Yellow Onions", category: "produce", subcategory: "Vegetables", price: 1.19, unit: "lb", inStock: true, aisle: "A2" },
    { name: "Russet Potatoes", category: "produce", subcategory: "Vegetables", price: 0.99, unit: "lb", inStock: true, aisle: "A2" },
    { name: "Bell Peppers", category: "produce", subcategory: "Vegetables", price: 1.49, unit: "each", inStock: true, aisle: "A2" },
    { name: "Almond Milk", category: "dairy", subcategory: "Milk", price: 3.79, unit: "half gallon", inStock: true, aisle: "B1" },
    { name: "Mozzarella Cheese", category: "dairy", subcategory: "Cheese", price: 4.29, unit: "8oz bag", inStock: true, aisle: "B2" },
    { name: "Sour Cream", category: "dairy", subcategory: "Cream", price: 2.29, unit: "16oz", inStock: true, aisle: "B2" },
    { name: "Cream Cheese", category: "dairy", subcategory: "Cheese", price: 2.49, unit: "8oz", inStock: true, aisle: "B2" },
    { name: "Heavy Cream", category: "dairy", subcategory: "Cream", price: 3.49, unit: "pint", inStock: true, aisle: "B1" },
    { name: "Cottage Cheese", category: "dairy", subcategory: "Cheese", price: 3.19, unit: "16oz", inStock: true, aisle: "B2" },
    { name: "Pork Chops", category: "meat", subcategory: "Pork", price: 5.49, unit: "lb", inStock: true, aisle: "C1" },
    { name: "Bacon", category: "meat", subcategory: "Pork", price: 6.99, unit: "12oz pack", inStock: true, aisle: "C1" },
    { name: "Italian Sausage", category: "meat", subcategory: "Pork", price: 5.99, unit: "lb", inStock: true, aisle: "C1" },
    { name: "Ribeye Steak", category: "meat", subcategory: "Beef", price: 15.99, unit: "lb", inStock: true, aisle: "C1" },
    { name: "Shrimp", category: "meat", subcategory: "Seafood", price: 9.99, unit: "lb", inStock: true, aisle: "C2" },
    { name: "Ground Turkey", category: "meat", subcategory: "Poultry", price: 5.49, unit: "lb", inStock: true, aisle: "C1" },
    { name: "Croissants", category: "bakery", subcategory: "Pastry", price: 4.99, unit: "4 pack", inStock: true, aisle: "D1" },
    { name: "Blueberry Muffins", category: "bakery", subcategory: "Pastry", price: 4.49, unit: "4 pack", inStock: true, aisle: "D2" },
    { name: "Hamburger Buns", category: "bakery", subcategory: "Bread", price: 2.99, unit: "8 pack", inStock: true, aisle: "D1" },
    { name: "Sourdough Loaf", category: "bakery", subcategory: "Bread", price: 4.29, unit: "loaf", inStock: true, aisle: "D1" },
    { name: "Cinnamon Rolls", category: "bakery", subcategory: "Pastry", price: 5.49, unit: "5 pack", inStock: true, aisle: "D2" },
    { name: "Frozen Broccoli", category: "frozen", subcategory: "Vegetables", price: 2.19, unit: "12oz bag", inStock: true, aisle: "E1" },
    { name: "Frozen Berries", category: "frozen", subcategory: "Fruits", price: 4.99, unit: "16oz bag", inStock: true, aisle: "E1" },
    { name: "Frozen French Fries", category: "frozen", subcategory: "Sides", price: 3.29, unit: "28oz bag", inStock: true, aisle: "E1" },
    { name: "Chicken Nuggets", category: "frozen", subcategory: "Meals", price: 6.49, unit: "24oz bag", inStock: true, aisle: "E1" },
    { name: "Frozen Waffles", category: "frozen", subcategory: "Breakfast", price: 3.99, unit: "10 count", inStock: true, aisle: "E1" },
    { name: "Ice Cream Sandwiches", category: "frozen", subcategory: "Desserts", price: 4.99, unit: "12 pack", inStock: true, aisle: "E2" },
    { name: "Olive Oil", category: "pantry", subcategory: "Oils", price: 8.99, unit: "16.9oz", inStock: true, aisle: "F1" },
    { name: "Peanut Butter", category: "pantry", subcategory: "Spreads", price: 3.49, unit: "16oz jar", inStock: true, aisle: "F2" },
    { name: "Strawberry Jam", category: "pantry", subcategory: "Spreads", price: 3.29, unit: "18oz jar", inStock: true, aisle: "F2" },
    { name: "Honey", category: "pantry", subcategory: "Sweeteners", price: 5.99, unit: "12oz bottle", inStock: true, aisle: "F2" },
    { name: "Canned Black Beans", category: "pantry", subcategory: "Canned Goods", price: 1.19, unit: "15oz can", inStock: true, aisle: "F1" },
    { name: "Chicken Broth", category: "pantry", subcategory: "Soups", price: 2.49, unit: "32oz carton", inStock: true, aisle: "F1" },
    { name: "Rolled Oats", category: "pantry", subcategory: "Grains", price: 3.99, unit: "18oz canister", inStock: true, aisle: "F3" },
    { name: "Granulated Sugar", category: "pantry", subcategory: "Baking", price: 3.29, unit: "4lb bag", inStock: true, aisle: "F3" },
    { name: "Popcorn", category: "snacks", subcategory: "Chips", price: 2.99, unit: "7oz bag", inStock: true, aisle: "H1" },
    { name: "Trail Mix", category: "snacks", subcategory: "Nuts", price: 5.99, unit: "16oz bag", inStock: true, aisle: "H2" },
    { name: "Almonds", category: "snacks", subcategory: "Nuts", price: 7.49, unit: "12oz bag", inStock: true, aisle: "H2" },
    { name: "Dark Chocolate Bar", category: "snacks", subcategory: "Candy", price: 2.99, unit: "3.5oz bar", inStock: true, aisle: "H2" },
    { name: "Crackers", category: "snacks", subcategory: "Crackers", price: 3.29, unit: "10oz box", inStock: true, aisle: "H1" },
    { name: "Gummy Bears", category: "snacks", subcategory: "Candy", price: 2.49, unit: "8oz bag", inStock: true, aisle: "H2" },
    { name: "Orange Juice", category: "beverages", subcategory: "Juice", price: 4.49, unit: "52oz", inStock: true, aisle: "G1" },
    { name: "Sparkling Water", category: "beverages", subcategory: "Water", price: 5.99, unit: "12 pack", inStock: true, aisle: "G1" },
    { name: "Cold Brew Coffee", category: "beverages", subcategory: "Coffee", price: 4.99, unit: "32oz bottle", inStock: true, aisle: "G2" },
    { name: "Green Tea", category: "beverages", subcategory: "Tea", price: 3.99, unit: "20 bags", inStock: true, aisle: "G2" },
    { name: "Lemonade", category: "beverages", subcategory: "Juice", price: 3.49, unit: "59oz", inStock: true, aisle: "G1" },
    { name: "Coconut Water", category: "beverages", subcategory: "Water", price: 2.49, unit: "16.9oz", inStock: true, aisle: "G1" },
    { name: "Sliced Turkey Breast", category: "deli", subcategory: "Lunch Meat", price: 7.99, unit: "lb", inStock: true, aisle: "I1" },
    { name: "Sliced Ham", category: "deli", subcategory: "Lunch Meat", price: 6.99, unit: "lb", inStock: true, aisle: "I1" },
    { name: "Swiss Cheese Slices", category: "deli", subcategory: "Cheese", price: 4.49, unit: "8oz pack", inStock: true, aisle: "I1" },
    { name: "Hummus", category: "deli", subcategory: "Dips", price: 3.99, unit: "10oz tub", inStock: true, aisle: "I2" },
    { name: "Rotisserie Chicken", category: "deli", subcategory: "Prepared", price: 7.99, unit: "each", inStock: true, aisle: "I2" },
    { name: "Potato Salad", category: "deli", subcategory: "Prepared", price: 4.49, unit: "lb", inStock: true, aisle: "I2" },
    { name: "Guacamole", category: "deli", subcategory: "Dips", price: 4.29, unit: "8oz tub", inStock: true, aisle: "I2" },
    { name: "Paper Towels", category: "household", subcategory: "Paper", price: 9.99, unit: "6 rolls", inStock: true, aisle: "J1" },
    { name: "Toilet Paper", category: "household", subcategory: "Paper", price: 12.99, unit: "12 rolls", inStock: true, aisle: "J1" },
    { name: "Dish Soap", category: "household", subcategory: "Cleaning", price: 3.49, unit: "19oz bottle", inStock: true, aisle: "J2" },
    { name: "Laundry Detergent", category: "household", subcategory: "Laundry", price: 12.99, unit: "92oz bottle", inStock: true, aisle: "J2" },
    { name: "All-Purpose Cleaner", category: "household", subcategory: "Cleaning", price: 3.99, unit: "32oz spray", inStock: true, aisle: "J2" },
    { name: "Trash Bags", category: "household", subcategory: "Bags", price: 8.49, unit: "45 count", inStock: true, aisle: "J3" },
    { name: "Sponges", category: "household", subcategory: "Cleaning", price: 3.29, unit: "6 pack", inStock: true, aisle: "J2" },
    { name: "Aluminum Foil", category: "household", subcategory: "Kitchen", price: 4.99, unit: "75 sq ft", inStock: true, aisle: "J3" },
    { name: "Paper Plates", category: "household", subcategory: "Kitchen", price: 4.49, unit: "50 count", inStock: true, aisle: "J3" },
    { name: "Toothpaste", category: "health", subcategory: "Oral Care", price: 3.49, unit: "4.7oz tube", inStock: true, aisle: "K1" },
    { name: "Shampoo", category: "health", subcategory: "Hair Care", price: 5.99, unit: "12oz bottle", inStock: true, aisle: "K1" },
    { name: "Body Wash", category: "health", subcategory: "Skin Care", price: 5.49, unit: "18oz bottle", inStock: true, aisle: "K1" },
    { name: "Hand Soap", category: "health", subcategory: "Skin Care", price: 2.99, unit: "11oz pump", inStock: true, aisle: "K1" },
    { name: "Deodorant", category: "health", subcategory: "Personal Care", price: 4.99, unit: "2.6oz stick", inStock: true, aisle: "K1" },
    { name: "Pain Reliever", category: "health", subcategory: "Medicine", price: 8.99, unit: "100 tablets", inStock: true, aisle: "K2" },
    { name: "Vitamin C", category: "health", subcategory: "Vitamins", price: 9.49, unit: "120 tablets", inStock: true, aisle: "K2" },
    { name: "Band-Aids", category: "health", subcategory: "First Aid", price: 4.29, unit: "30 count", inStock: true, aisle: "K2" }
];

// Function to seed products
async function seedProducts() {
    console.log('Starting to seed products...');
    
    let successCount = 0;
    let errorCount = 0;

    // Skip products that already exist so the script can be re-run safely
    const existing = new Set();
    let cursor = null;
    while (true) {
        const queries = [sdk.Query.limit(100), sdk.Query.select(['name'])];
        if (cursor) queries.push(sdk.Query.cursorAfter(cursor));
        const page = await databases.listDocuments(DATABASE_ID, PRODUCTS_COLLECTION_ID, queries);
        page.documents.forEach((d) => existing.add(d.name));
        if (page.documents.length < 100) break;
        cursor = page.documents[page.documents.length - 1].$id;
    }

    for (const product of sampleProducts) {
        if (existing.has(product.name)) {
            console.log(`- Skipped (exists): ${product.name}`);
            continue;
        }
        try {
            await databases.createDocument(
                DATABASE_ID,
                PRODUCTS_COLLECTION_ID,
                'unique()', // Let Appwrite generate a unique ID
                product
            );
            console.log(`✓ Added: ${product.name}`);
            successCount++;
        } catch (error) {
            console.error(`✗ Failed to add ${product.name}:`, error.message);
            errorCount++;
        }
    }

    console.log('\n=== Seeding Complete ===');
    console.log(`Successfully added: ${successCount} products`);
    console.log(`Failed: ${errorCount} products`);
}

// Run the seeding function
seedProducts()
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });