# Silvert Supply Co. - B2B E-Commerce Platform PRD

## Original Problem Statement
Build a production-ready B2B e-commerce web application for a high-volume food distribution company similar to Julius Silvert. Serves restaurants, chefs, and bulk buyers with complex B2B workflows including bulk ordering, custom pricing, and account-based purchasing.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Auth**: JWT + Emergent Google OAuth

## User Personas
1. **Admin** - Full control: products, inventory, orders, customers, analytics
2. **Business Customer** - Restaurant/chef: browse, order, reorder, manage cart
3. **Sub-users** - Employees under business accounts (planned)

## Core Requirements
- [x] User roles & authentication (JWT + Google Auth)
- [x] Product catalog (24 SKUs across 8 categories)
- [x] B2B pricing engine with volume-based tiers
- [x] Bulk ordering with inline editing
- [x] Persistent cart with session sync
- [x] Checkout flow with delivery date selection
- [x] Search with fuzzy matching & synonyms
- [x] Inventory alerts (in stock / low stock / out of stock)
- [x] Admin dashboard with analytics
- [x] Responsive dark premium UI

## What's Been Implemented (April 2026)
### Backend
- Full JWT auth (register, login, logout, refresh, me)
- Google OAuth via Emergent
- Product CRUD with 24 seeded products
- Cart system (add, update, remove, clear)
- Order system with minimum $50 validation
- Reorder previous purchase
- Search with synonym support
- Admin analytics (revenue, top products, daily stats)
- Admin order/inventory/customer management
- Brute force protection indexes

### Frontend
- Dark charcoal + gold theme (Chivo/Inter/JetBrains Mono)
- Homepage (hero, trust badges, categories, featured products)
- Product listing with filters, sort, pagination
- Product detail with bulk pricing table
- Cart with inline quantity editing
- Checkout with Calendar date picker
- Order history with expand/reorder
- Admin dashboard (overview, orders, inventory, customers)
- Mini-cart dropdown
- Search with autocomplete
- Google Auth callback

## Prioritized Backlog
### P0 (Next)
- Sub-user management (permissions under business accounts)
- Real product images per item
- Customer-specific pricing management UI

### P1
- Requisition list (save/name lists of products)
- Email notifications (order confirmation)
- PDF invoice generation
- Product import/export (CSV)

### P2
- Real payment integration (Stripe)
- Advanced analytics with date ranges
- Mobile app optimization
- Delivery tracking
- Customer credit terms
