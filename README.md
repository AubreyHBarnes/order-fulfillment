# Grocery Fulfillment App

> A full-stack React Native mobile application for online grocery ordering and fulfillment, inspired by Whole Foods' internal shopper app.

[![React Native](https://img.shields.io/badge/React%20Native-0.73-blue.svg)](https://reactnative.dev/)
[![Appwrite](https://img.shields.io/badge/Appwrite-1.5-f02e65.svg)](https://appwrite.io/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[🎥 Watch Demo Video](#) | [📱 Screenshots](#screenshots) | [📖 Engineering Decision Log](docs/DECISIONS.md)

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
- 🛒 **Product Browsing** - Search, filter by category, browse grocery items
- 🔍 **Smart Search** - Find products quickly with search functionality
- 🛍️ **Shopping Cart** - Persistent cart using AsyncStorage
- 📦 **Checkout & Order Placement** - Choose between delivery or pickup fulfillment, place orders against the real backend
- 📋 **Order History** - View past and in-progress orders, order detail screens
- 🔔 **Real-time Tracking** - Live order status updates (not yet implemented)
- 📱 **Pickup Notifications** - "I've arrived" service/UI exists (`arrivalService.ts`, `ArrivalNotificationCard`), end-to-end flow still in progress

### For Shoppers
- 📋 **Order Dashboard & Available Tasks** - View and manage assigned/available orders (implemented)
- 🔍 **Task Detail** - View and work an individual order's items (implemented)
- ⚡ **Auto-Assignment** - Orders can be flagged `autoAssigned` on placement; this is a simple client-side flag today, not yet a ranking/routing algorithm or serverless function
- 🚗 **Drop-offs / Customer Check-ins / Settings** - Screens exist but are static placeholders, not yet functional

### Technical Highlights
- 🔐 **Role-Based Authentication** - Separate customer and shopper access
- 🎨 **Light/Dark Theme System** - `ThemeContext` with dedicated light/dark theme definitions
- 📱 **Material Design 3** - Modern, responsive UI with React Native Paper
- 🔄 **Real-time Synchronization** - WebSocket subscriptions via Appwrite Realtime (planned, not yet implemented)

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

- **Node.js** (v20 or higher) and npm
  ```bash
  node --version  # Should be >= 20.x.x
  npm --version
  ```

  No global React Native CLI install is needed — this project uses `@react-native-community/cli` as a local devDependency, invoked via the `npm start` / `npm run android` / `npm run ios` scripts (or `npx react-native ...` directly).

- **JDK 21** (for Android) — install the full JDK, not just the JRE (`openjdk-21-jdk`, not `openjdk-21-jre`), since Gradle's toolchain needs `javac`.
  ```bash
  java -version   # Should be 21.x.x
  javac -version  # Confirms the full JDK is installed, not just the JRE
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

Create a `.env` file in the project root (there's no `.env.example` template to copy — create it directly) with your Appwrite credentials:

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

#### 5. Add Sample Data

There's no seed script in this repo yet — populate the Products collection manually via the Appwrite console (Databases → your database → Products → Create Document), or write your own script against `node-appwrite` using the schema above.

#### 6. Run the Application

**For Android:**

```bash
# Start Metro bundler in one terminal
npm start

# In a second terminal, build and install on Android
npm run android
```

Run these in two separate terminals. `npm run android` alone can spawn Metro automatically in an interactive terminal, but in headless/non-interactive setups (e.g. SSH, some CI/VM environments) that auto-launch fails silently and the installed app just hangs on a blank screen waiting for the bundler — so start Metro explicitly first.

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
6. **Checkout** - Choose delivery or pickup and place the order

### As a Shopper

1. **View Dashboard / Available Tasks** - See assigned and available orders
2. **Open Task Detail** - Work an individual order
3. **Fulfill Items, Handle Substitutions, Complete Order** - Not yet implemented; only the dashboard and task-detail/available-tasks views are functional today
4. **Drop-offs, Customer Check-ins, Settings** - Screens exist in navigation but are static placeholders

---

## 🏗️ Project Structure

```
order-fulfillment/
├── android/                 # Android native code
├── ios/                     # iOS native code
├── src/
│   ├── components/
│   │   ├── customer/         # Cart, checkout, order, and product-card components
│   │   └── shopper/           # Task and status-dropdown components
│   ├── context/
│   │   ├── AuthContext.tsx   # Authentication state
│   │   ├── CartContext.tsx   # Shopping cart state
│   │   └── ThemeContext.tsx  # Light/dark theme state
│   ├── navigation/
│   │   └── AppNavigator.tsx  # Navigation structure
│   ├── screens/
│   │   ├── auth/              # Login, register, forgot-password
│   │   ├── customer/          # Home, cart, checkout, orders, order detail/confirmation
│   │   ├── shopper/            # Dashboard, available tasks, task detail, drop-offs, check-ins, settings
│   │   └── TestConnectionScreen.tsx
│   ├── services/
│   │   ├── appwrite.ts        # Appwrite client config
│   │   ├── productService.ts
│   │   ├── orderService.ts
│   │   ├── userService.ts
│   │   ├── shopperStatusService.ts
│   │   └── arrivalService.ts
│   ├── theme/                 # Colors, light/dark theme definitions
│   └── types/                 # Shared TypeScript types
├── docs/                     # Debugging/session logs
├── .env                      # Environment variables (not in git)
├── .gitignore
├── App.tsx                   # Root component
├── index.ts                  # Entry point
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

- [x] **Phase 3.3:** Shopping Cart Screen
- [x] **Phase 3.4:** Checkout Flow

### In Progress 🚧
- [ ] **Phase 4:** Shopper Fulfillment Interface
  - [x] Order dashboard, available tasks, task detail
  - [ ] Item fulfillment / pick-items workflow (no in-app way to claim or complete an order yet)
  - [ ] Customer arrival notifications (service layer exists, UI/flow incomplete)
  - [ ] Drop-offs, customer check-ins, and settings screens (currently static placeholders)

### Planned 📋
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