# PayPulse - Income Tracker

## Features

- **Track Shifts**: Log work hours, earnings, and expenses
- **Tips Support**: Record tips/gratuities separately
- **Currency Selector**: Choose from 10+ currencies (CAD, USD, EUR, GBP, AUD, INR, JPY, AED, SGD, NZD)
- **Customizable Fields**: Enable/disable expense fields (grocery, phone, wifi, food, maintenance, insurance, misc, other)
- **Theme Toggle**: Dark mode, Light mode, or System default
- **Password Visibility**: Eye icon to temporarily reveal passwords
- **Forgot Password**: Security question-based password recovery
- **AI PDF Reports**: Export detailed analysis with trends and recommendations
- **Charts**: Visualize earnings, expenses, hours, and delivery trends
- **Persistent Data**: PostgreSQL database via Neon (data survives forever)

## Deploy to Render.com

### File Structure
```
paypulse-income-tracker/
├── package.json
├── server.js
├── logo.png          ← Add your PayPulse logo here
├── .gitignore
├── README.md
└── public/
    ├── index.html
    └── app.js
```

### Steps:
1. Upload ALL files to GitHub repo root
2. Add your `logo.png` to the root folder (not inside public/)
3. On Render, set:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Root Directory:** (leave blank or set to `.`)
4. Add Environment Variable:
   - **Key:** `DATABASE_URL`
   - **Value:** Your Neon PostgreSQL connection string
5. Deploy

### Neon PostgreSQL Setup
1. Go to [neon.tech](https://neon.tech)
2. Create free account and project
3. Copy connection string
4. Paste into Render Environment Variables

### Logo Setup
- Save your PayPulse logo as `logo.png` in the project root
- The app will use it as the favicon and auth screen branding
- Recommended size: 512x512px or larger

## Currency Support
CAD ($), USD ($), EUR (€), GBP (£), AUD ($), INR (₹), JPY (¥), AED (د.إ), SGD ($), NZD ($)

## Customizable Expense Fields
Users can enable/disable these fields in Settings:
- Grocery, Phone Bill, WiFi Bill, Food/Rest
- Car Maintenance, Insurance, Misc, Other
