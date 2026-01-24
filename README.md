# Grocery Fulfillment App

> A full-stack React Native mobile application for online grocery ordering and fulfillment, inspired by Whole Foods' internal shopper app.

[![React Native](https://img.shields.io/badge/React%20Native-0.73-blue.svg)](https://reactnative.dev/)
[![Appwrite](https://img.shields.io/badge/Appwrite-1.5-f02e65.svg)](https://appwrite.io/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[🎥 Watch Demo Video](#) | [📱 Screenshots](#screenshots) | [📖 Technical Article](#)

---

## 📱 About The Project

A mobile-first grocery shopping application featuring dual user roles (customers and shoppers), real-time order updates, and intelligent auto-assignment of orders to available shoppers.

**Built as a portfolio project to demonstrate:**
- Full-stack mobile development with React Native
- Real-time data synchronization using WebSockets
- Complex state management with Context API
- Backend-as-a-Service integration (Appwrite)
- Accessible, production-ready UI following Material Design 3
- Serverless function architecture

---

## ✨ Features

### For Customers
- 🛒 **Product Browsing** - Search, filter by category, browse 30+ grocery items
- 🔍 **Smart Search** - Find products quickly with search functionality
- 🛍️ **Shopping Cart** - Persistent cart using AsyncStorage
- 📦 **Order Placement** - Choose between delivery or pickup fulfillment
- 🔔 **Real-time Tracking** - Live order status updates (in progress)
- 📱 **Pickup Notifications** - "I've arrived" feature for curbside pickup (in progress)

### For Shoppers (In Progress - Phase 4)
- 📋 **Order Dashboard** - View and manage assigned orders
- ⚡ **Auto-Assignment** - Intelligent order routing via serverless functions
- ✅ **Item Fulfillment** - Check off items as they're found
- 🔄 **Real-time Updates** - Notify customers of substitutions instantly
- 🚗 **Customer Arrivals** - Receive alerts when customers arrive for pickup

### Technical Highlights
- ⚡ **Auto-Assignment Algorithm** - Ranks shoppers by availability and workload
- 🔄 **Real-time Synchronization** - WebSocket subscriptions via Appwrite Realtime
- 🔐 **Role-Based Authentication** - Separate customer and shopper access
- ♿ **Accessibility First** - WCAG 2.1 AA compliant with screen reader support
- 📱 **Material Design 3** - Modern, responsive UI with React Native Paper
- 🎨 **8pt Grid System** - Consistent spacing and visual hierarchy

---

## 🛠️ Built With

### Frontend
- **[React Native](https://reactnative.dev/)** 0.73 - Cross-platform mobile framework
- **[React Native Paper](https://callstack.github.io/react-native-paper/)** - Material Design 3 components
- **[React Navigation](https://reactnavigation.org/)** 6 - Navigation library
- **[AsyncStorage](https://react-native-async-storage.github.io/)** - Persistent local storage

### Backend
- **[Appwrite](https://appwrite.io/)** - Backend-as-a-Service platform
  - Database (NoSQL)
  - Authentication (Email/Password)
  - Realtime (WebSocket subscriptions)
  - Functions (Node.js serverless)
  - Storage (File uploads - planned)

### Development Tools
- **Android Studio** - Android development environment
- **Metro Bundler** - JavaScript bundler
- **ESLint** - Code linting
- **Git** - Version control

---

## 🚀 Getting Started

Follow these instructions to get the project running on your local machine.

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) and npm
  ```bash
  node --version  # Should be >= 18.x.x
  npm --version
  ```

- **React Native CLI**
  ```bash
  npm install -g react-native-cli
  ```

- **JDK 17** (for Android)
  ```bash
  java -version  # Should be 17.x.x
  ```

- **Android Studio** with Android SDK (for Android development)
  - Android SDK Platform 33 or higher
  - Android SDK Build-Tools 36.0.0

- **Xcode** (for iOS development, macOS only)

- **Watchman** (recommended for Linux/macOS)
  ```bash
  # macOS
  brew install watchman
  
  # Linux
  # Follow instructions at https://facebook.github.io/watchman/docs/install
  ```

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/grocery-fulfillment-app.git
cd grocery-fulfillment-app
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Set Up Appwrite Backend

**a. Create Appwrite Account**
- Go to [cloud.appwrite.io](https://cloud.appwrite.io)
- Sign up for a free account
- Create a new project (e.g., "Grocery Fulfillment App")
- Note your **Project ID**

**b. Create Database**
- In your Appwrite project, go to "Databases"
- Click "Create Database"
- Name it `GroceryDB`
- Note your **Database ID**

**c. Create Collections**

Create these 7 collections with the specified attributes:

**1. Users Collection**
| Attribute | Type | Size | Required | Default |
|-----------|------|------|----------|---------|
| userID | String | 255 | Yes | - |
| role | Enum | - | Yes | - |
| firstName | String | 100 | Yes | - |
| lastName | String | 100 | Yes | - |
| phoneNumber | String | 20 | No | null |
| profileImage | URL | - | No | null |

*Enum values for `role`: customer, shopper*

**Permissions:** Any - Create, Read, Update

---

**2. Products Collection**
| Attribute | Type | Size | Required | Default |
|-----------|------|------|----------|---------|
| name | String | 200 | Yes | - |
| category | Enum | - | Yes | - |
| subcategory | String | 100 | No | - |
| price | Float | - | Yes | - |
| unit | String | 20 | Yes | each |
| imageUrl | URL | - | No | null |
| inStock | Boolean | - | Yes | true |
| aisle | String | 10 | No | - |
| barcode | String | 50 | No | - |

*Enum values for `category`: produce, meat, dairy, bakery, frozen, pantry, beverages, snacks*

**Permissions:** Any - Read

---

**3. Orders Collection**
| Attribute | Type | Size | Required | Default |
|-----------|------|------|----------|---------|
| customerId | String | 255 | Yes | - |
| shopperId | String | 255 | No | - |
| status | Enum | - | Yes | pending |
| items | String | 65535 | Yes | - |
| totalAmount | Float | - | Yes | - |
| deliveryAddress | String | 500 | Yes | - |
| deliveryNotes | String | 1000 | No | - |
| fulfillmentType | Enum | - | Yes | delivery |
| pickupLocation | String | 200 | No | - |
| autoAssigned | Boolean | - | Yes | false |
| priority | Integer | - | Yes | 0 |
| interruptedAt | DateTime | - | No | - |
| interruptReason | String | 500 | No | - |
| orderDate | DateTime | - | Yes | - |
| assignedDate | DateTime | - | No | - |
| completedDate | DateTime | - | No | - |

*Enum values for `status`: pending, assigned, shopping, completed, cancelled, ready_for_pickup*
*Enum values for `fulfillmentType`: delivery, pickup*

**Permissions:** Any - Create, Read, Update

---

**4. ShopperStatus Collection**
| Attribute | Type | Size | Required | Default |
|-----------|------|------|----------|---------|
| shopperId | String | 255 | Yes | - |
| isAvailable | Boolean | - | Yes | true |
| currentOrderId | String | 255 | No | - |
| location | String | 100 | No | - |
| maxConcurrentOrders | Integer | - | Yes | 1 |
| lastActiveTimestamp | DateTime | - | Yes | - |

**Permissions:** Any - Create, Read, Update

---

**5. CustomerArrivals Collection**
| Attribute | Type | Size | Required | Default |
|-----------|------|------|----------|---------|
| orderId | String | 255 | Yes | - |
| customerId | String | 255 | Yes | - |
| arrivedAt | DateTime | - | Yes | - |
| parkingSpot | String | 20 | No | - |
| notifiedShopperAt | DateTime | - | No | - |
| status | Enum | - | Yes | waiting |

*Enum values for `status`: waiting, notified, in_progress, completed*

**Permissions:** Any - Create, Read, Update

---

**6. OrderQueue Collection**
| Attribute | Type | Size | Required | Default |
|-----------|------|------|----------|---------|
| orderId | String | 255 | Yes | - |
| queuePosition | Integer | - | Yes | - |
| createdAt | DateTime | - | Yes | - |
| estimatedShopTime | Integer | - | No | - |
| preferredShopperId | String | 255 | No | - |

**Permissions:** Any - Create, Read, Update, Delete

---

**7. OrderMessages Collection** (Optional)
| Attribute | Type | Size | Required | Default |
|-----------|------|------|----------|---------|
| orderId | String | 255 | Yes | - |
| senderId | String | 255 | Yes | - |
| message | String | 2000 | Yes | - |
| timestamp | DateTime | - | Yes | - |
| isRead | Boolean | - | Yes | false |

**Permissions:** Any - Create, Read, Update

---

**d. Add Platform**
- Go to "Settings" → "Platforms"
- Click "Add Platform"
- Select "Flutter" (works for React Native)
- **For Android:**
  - Application Name: `Grocery Fulfillment`
  - Package Name: `com.groceryfulfillmentapp`
- **For iOS:**
  - Application Name: `Grocery Fulfillment`
  - Bundle ID: `com.groceryfulfillmentapp`

#### 4. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your Appwrite credentials:

```env
APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id_here
APPWRITE_DATABASE_ID=your_database_id_here
APPWRITE_USERS_COLLECTION_ID=your_users_collection_id
APPWRITE_PRODUCTS_COLLECTION_ID=your_products_collection_id
APPWRITE_ORDERS_COLLECTION_ID=your_orders_collection_id
APPWRITE_SHOPPER_STATUS_COLLECTION_ID=your_shopper_status_collection_id
APPWRITE_CUSTOMER_ARRIVALS_COLLECTION_ID=your_customer_arrivals_collection_id
APPWRITE_ORDER_QUEUE_COLLECTION_ID=your_order_queue_collection_id
APPWRITE_ORDER_MESSAGES_COLLECTION_ID=your_order_messages_collection_id
```

**⚠️ Important:** Replace `your_project_id_here` and collection IDs with your actual IDs from Appwrite.

**Note:** Your endpoint might be different based on region:
- Global: `https://cloud.appwrite.io/v1`
- NYC: `https://nyc.cloud.appwrite.io/v1`
- EU: `https://eu.cloud.appwrite.io/v1`

Check your Appwrite project settings for the correct endpoint.

#### 5. Seed Sample Data

Populate the Products collection with sample grocery items:

```bash
cd scripts
npm install node-appwrite

# Edit seedProducts.js and add your Project ID and API Key
# (Create API key in Appwrite: Settings → API Keys)
nano seedProducts.js

# Run the seed script
node seedProducts.js

cd ..
```

#### 6. Run the Application

**For Android:**

```bash
# Start Metro bundler
npm start

# In a new terminal, run on Android
npm run android

# Or all in one:
npm run android
```

**For iOS (macOS only):**

```bash
# Install pods
cd ios && pod install && cd ..

# Run on iOS
npm run ios
```

---

## 📱 Usage

### First Time Setup

1. **Launch the app** - You'll see the login screen
2. **Register a new account**:
   - Click "Sign Up"
   - Fill in your details
   - Select role: **Customer** (for shopping) or **Shopper** (for fulfillment)
   - Create account
3. **Login** with your new credentials

### As a Customer

1. **Browse Products** - Scroll through the product grid
2. **Search** - Use the search bar to find specific items
3. **Filter by Category** - Tap category chips to filter
4. **Add to Cart** - Tap "Add to Cart" on any product
5. **View Cart** - Tap cart icon (shows item count)
6. **Checkout** - Complete order (Phase 3.4 - in progress)

### As a Shopper (Phase 4 - In Progress)

1. **View Dashboard** - See available orders
2. **Accept Order** - Auto-assigned or manually accept
3. **Fulfill Items** - Check off items as found
4. **Handle Substitutions** - Notify customers
5. **Complete Order** - Mark as ready for delivery/pickup

---

## 🏗️ Project Structure

```
GroceryFulfillmentApp/
├── android/                 # Android native code
├── ios/                     # iOS native code
├── src/
│   ├── components/
│   │   ├── common/          # Shared components
│   │   ├── customer/
│   │   │   └── ProductCard.js
│   │   └── shopper/
│   ├── constants/
│   │   └── theme.js         # Design system (colors, typography)
│   ├── context/
│   │   ├── AuthContext.js   # Authentication state
│   │   └── CartContext.js   # Shopping cart state
│   ├── hooks/               # Custom React hooks
│   ├── navigation/
│   │   └── AppNavigator.js  # Navigation structure
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.js
│   │   │   ├── RegisterScreen.js
│   │   │   └── ForgotPasswordScreen.js
│   │   ├── customer/
│   │   │   └── CustomerHomeScreen.js
│   │   └── shopper/
│   ├── services/
│   │   ├── appwrite.js      # Appwrite client config
│   │   └── productService.js # Product data layer
│   └── utils/               # Helper functions
├── scripts/
│   └── seedProducts.js      # Database seeding script
├── .env                     # Environment variables (not in git)
├── .env.example             # Environment template
├── .gitignore
├── App.js                   # Root component
├── package.json
└── README.md
```

---

## 🧪 Testing

```bash
# Run unit tests (when implemented)
npm test

# Run with coverage
npm test -- --coverage

# Lint code
npm run lint

# Format code
npm run format
```

---

## 🐛 Troubleshooting

### Common Issues

**Metro bundler won't start:**
```bash
npm start -- --reset-cache
```

**Android build fails:**
```bash
cd android
./gradlew clean
cd ..
npm run android
```

**iOS pods installation fails:**
```bash
cd ios
pod deintegrate
pod install
cd ..
```

**Blank white screen:**
- Check Metro bundler for errors
- Verify `.env` file exists with correct values
- Run: `npx react-native log-android` to see error logs
- Ensure all collection IDs in `.env` are correct

**"Cannot find module" errors:**
```bash
rm -rf node_modules
npm install
```

**Appwrite connection errors:**
- Verify endpoint URL in `.env` matches your Appwrite region
- Check Project ID is correct
- Ensure platform is added in Appwrite (Settings → Platforms)
- Verify collection permissions are set to "Any: Read/Create/Update"

---

## 🗺️ Roadmap

### Completed ✅
- [x] **Phase 1:** Foundation & Setup
  - Appwrite backend configuration
  - React Native project structure
  - Sample data seeded
- [x] **Phase 2:** Authentication & User Management
  - Role-based login/register
  - Persistent sessions
  - Password reset flow
- [x] **Phase 3:** Customer Shopping Experience
  - Product browsing with search/filter
  - Shopping cart with persistence
  - Product card components

### In Progress 🚧
- [ ] **Phase 3.3:** Shopping Cart Screen
- [ ] **Phase 3.4:** Checkout Flow

### Planned 📋
- [ ] **Phase 4:** Shopper Fulfillment Interface
  - Order dashboard
  - Item fulfillment workflow
  - Customer arrival notifications
- [ ] **Phase 5:** Real-time Features
  - WebSocket subscriptions
  - Auto-assignment serverless functions
  - Live order tracking
- [ ] **Phase 6:** Polish & Production
  - UI/UX improvements
  - Performance optimization
  - Comprehensive testing

---

## 🤝 Contributing

This is a portfolio project, but feedback and suggestions are welcome!

If you find a bug or have a feature suggestion:
1. Check if an issue already exists
2. Open a new issue with a clear description
3. Include steps to reproduce (for bugs)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Aubrey**

- Portfolio: [your-portfolio-site.com](#)
- LinkedIn: [linkedin.com/in/yourprofile](#)
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- [Appwrite](https://appwrite.io/) - Backend-as-a-Service platform
- [React Native Paper](https://callstack.github.io/react-native-paper/) - Material Design components
- [React Navigation](https://reactnavigation.org/) - Navigation library
- Inspired by Whole Foods shopper app and modern grocery fulfillment systems
- Thanks to the React Native community for excellent documentation and support

---

## 📚 Additional Resources

- [Technical Deep Dive](#) - Detailed architecture explanation (coming soon)
- [API Documentation](#) - Service layer docs (coming soon)
- [Video Walkthrough](#) - YouTube demo (coming soon)

---

**⭐ If you found this project helpful, please consider giving it a star!**

---

*Built with ❤️ using React Native, Appwrite, and lots of coffee ☕*