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
    }
];

// Function to seed products
async function seedProducts() {
    console.log('Starting to seed products...');
    
    let successCount = 0;
    let errorCount = 0;

    for (const product of sampleProducts) {
        try {
            const result = await databases.createDocument(
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