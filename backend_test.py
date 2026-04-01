#!/usr/bin/env python3
"""
Backend API Testing for Silvert Supply Co. B2B E-commerce Platform
Tests all authentication, product, cart, order, search, and admin endpoints
"""

import requests
import sys
import json
from datetime import datetime, timedelta

class SilvertAPITester:
    def __init__(self, base_url="https://bulk-chef-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        self.admin_session = requests.Session()
        self.user_session = requests.Session()
        
        # Test credentials from /app/memory/test_credentials.md
        self.admin_email = "admin@silvert.com"
        self.admin_password = "SilvertAdmin2024!"
        self.user_email = "chef@testrestaurant.com"
        self.user_password = "ChefTest2024!"

    def log_result(self, test_name, success, details="", expected_status=None, actual_status=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}")
            if details:
                print(f"   {details}")
        else:
            self.failed_tests.append({
                "test": test_name,
                "details": details,
                "expected_status": expected_status,
                "actual_status": actual_status
            })
            print(f"❌ {test_name}")
            if details:
                print(f"   {details}")
            if expected_status and actual_status:
                print(f"   Expected: {expected_status}, Got: {actual_status}")

    def make_request_with_session(self, session, method, endpoint, data=None, token=None, expected_status=200):
        """Make API request with specific session"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            if method == 'GET':
                response = session.get(url, headers=headers)
            elif method == 'POST':
                response = session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = session.delete(url, headers=headers)
            
            success = response.status_code == expected_status
            return success, response
            
        except Exception as e:
            return False, str(e)
        """Make API request with proper headers"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        # Use a clean session for unauthenticated tests
        session = requests.Session() if use_clean_session else self.session
        
        try:
            if method == 'GET':
                response = session.get(url, headers=headers)
            elif method == 'POST':
                response = session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = session.delete(url, headers=headers)
            
            success = response.status_code == expected_status
            return success, response
            
        except Exception as e:
            return False, str(e)

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication Endpoints...")
        
        # Test admin login with dedicated session
        admin_session = requests.Session()
        success, response = self.make_request_with_session(
            admin_session, 'POST', 'auth/login',
            data={"email": self.admin_email, "password": self.admin_password},
            expected_status=200
        )
        
        if success:
            try:
                data = response.json()
                if 'access_token' in data and 'user' in data:
                    self.admin_token = data['access_token']
                    self.admin_role = data['user'].get('role')
                    self.log_result("Admin Login", True, f"Role: {self.admin_role}")
                else:
                    self.log_result("Admin Login", False, "Missing access_token or user in response")
            except:
                self.log_result("Admin Login", False, "Invalid JSON response")
        else:
            self.log_result("Admin Login", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test user login with dedicated session
        user_session = requests.Session()
        success, response = self.make_request_with_session(
            user_session, 'POST', 'auth/login',
            data={"email": self.user_email, "password": self.user_password},
            expected_status=200
        )
        
        if success:
            try:
                data = response.json()
                if 'access_token' in data and 'user' in data:
                    self.user_token = data['access_token']
                    self.log_result("User Login", True, f"Role: {data['user'].get('role')}")
                else:
                    self.log_result("User Login", False, "Missing access_token or user in response")
            except:
                self.log_result("User Login", False, "Invalid JSON response")
        else:
            self.log_result("User Login", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test /auth/me with admin token
        if self.admin_token:
            success, response = self.make_request('GET', 'auth/me', token=self.admin_token)
            if success:
                try:
                    data = response.json()
                    user_role = data.get('user', {}).get('role')
                    self.log_result("Admin /auth/me", True, f"Role: {user_role}")
                    # Verify admin role consistency
                    if user_role != 'admin':
                        self.log_result("Admin Role Consistency", False, f"Expected admin, got {user_role}")
                except:
                    self.log_result("Admin /auth/me", False, "Invalid JSON response")
            else:
                self.log_result("Admin /auth/me", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test /auth/me with user token
        if self.user_token:
            success, response = self.make_request('GET', 'auth/me', token=self.user_token)
            if success:
                try:
                    data = response.json()
                    user_role = data.get('user', {}).get('role')
                    self.log_result("User /auth/me", True, f"Role: {user_role}")
                except:
                    self.log_result("User /auth/me", False, "Invalid JSON response")
            else:
                self.log_result("User /auth/me", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test registration
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@test.com"
        success, response = self.make_request(
            'POST', 'auth/register',
            data={
                "email": test_email,
                "password": "TestPass123!",
                "name": "Test User",
                "company_name": "Test Company"
            }
        )
        self.log_result("User Registration", success, f"Email: {test_email}" if success else f"Status: {response.status_code}", 200, response.status_code if hasattr(response, 'status_code') else None)

    def test_product_endpoints(self):
        """Test product endpoints"""
        print("\n📦 Testing Product Endpoints...")
        
        # Test GET /products
        success, response = self.make_request('GET', 'products')
        if success:
            try:
                data = response.json()
                products = data.get('products', [])
                total = data.get('total', 0)
                self.log_result("GET /products", True, f"Found {len(products)} products, total: {total}")
                
                # Store first product for later tests
                if products:
                    self.test_product_id = products[0].get('product_id')
                    self.test_product_name = products[0].get('name')
            except:
                self.log_result("GET /products", False, "Invalid JSON response")
        else:
            self.log_result("GET /products", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test GET /products/featured
        success, response = self.make_request('GET', 'products/featured')
        if success:
            try:
                data = response.json()
                featured = data.get('products', [])
                self.log_result("GET /products/featured", True, f"Found {len(featured)} featured products")
            except:
                self.log_result("GET /products/featured", False, "Invalid JSON response")
        else:
            self.log_result("GET /products/featured", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test GET /products/{id} if we have a product ID
        if hasattr(self, 'test_product_id') and self.test_product_id:
            success, response = self.make_request('GET', f'products/{self.test_product_id}')
            if success:
                try:
                    data = response.json()
                    product = data.get('product', {})
                    pricing_tiers = product.get('pricing_tiers', [])
                    self.log_result("GET /products/{id}", True, f"Product: {product.get('name')}, Tiers: {len(pricing_tiers)}")
                except:
                    self.log_result("GET /products/{id}", False, "Invalid JSON response")
            else:
                self.log_result("GET /products/{id}", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test product filters
        success, response = self.make_request('GET', 'products?category=Meat%20%26%20Poultry')
        if success:
            try:
                data = response.json()
                products = data.get('products', [])
                self.log_result("GET /products (category filter)", True, f"Found {len(products)} meat products")
            except:
                self.log_result("GET /products (category filter)", False, "Invalid JSON response")
        else:
            self.log_result("GET /products (category filter)", False, f"Status: {response.status_code}", 200, response.status_code)

    def test_search_endpoints(self):
        """Test search endpoints"""
        print("\n🔍 Testing Search Endpoints...")
        
        # Test search with query
        success, response = self.make_request('GET', 'search?q=salmon')
        if success:
            try:
                data = response.json()
                results = data.get('results', [])
                suggestions = data.get('suggestions', [])
                self.log_result("GET /search?q=salmon", True, f"Found {len(results)} results, {len(suggestions)} suggestions")
            except:
                self.log_result("GET /search?q=salmon", False, "Invalid JSON response")
        else:
            self.log_result("GET /search?q=salmon", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test empty search
        success, response = self.make_request('GET', 'search?q=')
        if success:
            try:
                data = response.json()
                results = data.get('results', [])
                self.log_result("GET /search (empty query)", True, f"Found {len(results)} popular products")
            except:
                self.log_result("GET /search (empty query)", False, "Invalid JSON response")
        else:
            self.log_result("GET /search (empty query)", False, f"Status: {response.status_code}", 200, response.status_code)

    def test_cart_endpoints(self):
        """Test cart endpoints (requires authentication)"""
        print("\n🛒 Testing Cart Endpoints...")
        
        if not self.user_token:
            self.log_result("Cart Tests", False, "No user token available")
            return

        # Test GET /cart (empty cart)
        success, response = self.make_request('GET', 'cart', token=self.user_token)
        if success:
            try:
                data = response.json()
                items = data.get('items', [])
                subtotal = data.get('subtotal', 0)
                self.log_result("GET /cart (initial)", True, f"Items: {len(items)}, Subtotal: ${subtotal}")
            except:
                self.log_result("GET /cart (initial)", False, "Invalid JSON response")
        else:
            self.log_result("GET /cart (initial)", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test POST /cart/items (add to cart)
        if hasattr(self, 'test_product_id') and self.test_product_id:
            success, response = self.make_request(
                'POST', 'cart/items',
                data={"product_id": self.test_product_id, "quantity": 2},
                token=self.user_token
            )
            self.log_result("POST /cart/items", success, f"Added {self.test_product_name}" if success else f"Status: {response.status_code}", 200, response.status_code if hasattr(response, 'status_code') else None)

            # Test GET /cart (with items)
            success, response = self.make_request('GET', 'cart', token=self.user_token)
            if success:
                try:
                    data = response.json()
                    items = data.get('items', [])
                    subtotal = data.get('subtotal', 0)
                    self.log_result("GET /cart (with items)", True, f"Items: {len(items)}, Subtotal: ${subtotal}")
                    
                    # Store for order test
                    self.cart_subtotal = subtotal
                except:
                    self.log_result("GET /cart (with items)", False, "Invalid JSON response")
            else:
                self.log_result("GET /cart (with items)", False, f"Status: {response.status_code}", 200, response.status_code)

            # Test PUT /cart/items/{product_id} (update quantity)
            success, response = self.make_request(
                'PUT', f'cart/items/{self.test_product_id}',
                data={"quantity": 5},
                token=self.user_token
            )
            self.log_result("PUT /cart/items/{id}", success, "Updated quantity to 5" if success else f"Status: {response.status_code}", 200, response.status_code if hasattr(response, 'status_code') else None)

    def test_order_endpoints(self):
        """Test order endpoints (requires authentication and cart items)"""
        print("\n📋 Testing Order Endpoints...")
        
        if not self.user_token:
            self.log_result("Order Tests", False, "No user token available")
            return

        # Check if cart has enough value for minimum order ($50)
        if not hasattr(self, 'cart_subtotal') or self.cart_subtotal < 50:
            # Add more items to cart to meet minimum
            if hasattr(self, 'test_product_id'):
                success, response = self.make_request(
                    'PUT', f'cart/items/{self.test_product_id}',
                    data={"quantity": 10},  # Increase quantity to meet minimum
                    token=self.user_token
                )

        # Test POST /orders (create order)
        delivery_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        success, response = self.make_request(
            'POST', 'orders',
            data={
                "delivery_date": delivery_date,
                "notes": "Test order from API testing"
            },
            token=self.user_token
        )
        
        if success:
            try:
                data = response.json()
                order = data.get('order', {})
                order_id = order.get('order_id')
                subtotal = order.get('subtotal', 0)
                self.log_result("POST /orders", True, f"Order ID: {order_id}, Subtotal: ${subtotal}")
                self.test_order_id = order_id
            except:
                self.log_result("POST /orders", False, "Invalid JSON response")
        else:
            self.log_result("POST /orders", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test GET /orders (list orders)
        success, response = self.make_request('GET', 'orders', token=self.user_token)
        if success:
            try:
                data = response.json()
                orders = data.get('orders', [])
                total = data.get('total', 0)
                self.log_result("GET /orders", True, f"Found {len(orders)} orders, total: {total}")
            except:
                self.log_result("GET /orders", False, "Invalid JSON response")
        else:
            self.log_result("GET /orders", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test POST /orders/{id}/reorder
        if hasattr(self, 'test_order_id') and self.test_order_id:
            success, response = self.make_request(
                'POST', f'orders/{self.test_order_id}/reorder',
                token=self.user_token
            )
            self.log_result("POST /orders/{id}/reorder", success, "Items added to cart" if success else f"Status: {response.status_code}", 200, response.status_code if hasattr(response, 'status_code') else None)

    def test_admin_endpoints(self):
        """Test admin endpoints (requires admin authentication)"""
        print("\n👑 Testing Admin Endpoints...")
        
        if not self.admin_token:
            self.log_result("Admin Tests", False, "No admin token available")
            return
            
        # Check if we have admin role
        if not hasattr(self, 'admin_role') or self.admin_role != 'admin':
            self.log_result("Admin Tests", False, f"Admin role verification failed. Role: {getattr(self, 'admin_role', 'unknown')}")
            return

        # Test GET /admin/analytics
        success, response = self.make_request('GET', 'admin/analytics', token=self.admin_token)
        if success:
            try:
                data = response.json()
                total_products = data.get('total_products', 0)
                total_orders = data.get('total_orders', 0)
                total_revenue = data.get('total_revenue', 0)
                self.log_result("GET /admin/analytics", True, f"Products: {total_products}, Orders: {total_orders}, Revenue: ${total_revenue}")
            except:
                self.log_result("GET /admin/analytics", False, "Invalid JSON response")
        else:
            self.log_result("GET /admin/analytics", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test GET /admin/orders
        success, response = self.make_request('GET', 'admin/orders', token=self.admin_token)
        if success:
            try:
                data = response.json()
                orders = data.get('orders', [])
                total = data.get('total', 0)
                self.log_result("GET /admin/orders", True, f"Found {len(orders)} orders, total: {total}")
                
                # Store first order for status update test
                if orders:
                    self.admin_test_order_id = orders[0].get('order_id')
            except:
                self.log_result("GET /admin/orders", False, "Invalid JSON response")
        else:
            self.log_result("GET /admin/orders", False, f"Status: {response.status_code}", 200, response.status_code)

        # Test PUT /admin/orders/{id}/status
        if hasattr(self, 'admin_test_order_id') and self.admin_test_order_id:
            success, response = self.make_request(
                'PUT', f'admin/orders/{self.admin_test_order_id}/status',
                data={"status": "processing"},
                token=self.admin_token
            )
            self.log_result("PUT /admin/orders/{id}/status", success, "Status updated to processing" if success else f"Status: {response.status_code}", 200, response.status_code if hasattr(response, 'status_code') else None)

        # Test GET /admin/inventory
        success, response = self.make_request('GET', 'admin/inventory', token=self.admin_token)
        if success:
            try:
                data = response.json()
                products = data.get('products', [])
                low_stock = [p for p in products if p.get('stock_status') == 'low_stock']
                out_of_stock = [p for p in products if p.get('stock_status') == 'out_of_stock']
                self.log_result("GET /admin/inventory", True, f"Products: {len(products)}, Low stock: {len(low_stock)}, Out of stock: {len(out_of_stock)}")
            except:
                self.log_result("GET /admin/inventory", False, "Invalid JSON response")
        else:
            self.log_result("GET /admin/inventory", False, f"Status: {response.status_code}", 200, response.status_code)

    def test_unauthorized_access(self):
        """Test that protected endpoints require authentication"""
        print("\n🔒 Testing Unauthorized Access...")
        
        # Test cart without token
        success, response = self.make_request('GET', 'cart', expected_status=401, use_clean_session=True)
        actual_status = response.status_code if hasattr(response, 'status_code') else 'unknown'
        self.log_result("GET /cart (no auth)", success, "Correctly rejected" if success else f"Status: {actual_status}", 401, actual_status)

        # Test admin endpoint with user token
        if self.user_token:
            success, response = self.make_request('GET', 'admin/analytics', token=self.user_token, expected_status=403)
            self.log_result("GET /admin/analytics (user token)", success, "Correctly rejected" if success else f"Status: {response.status_code}", 403, response.status_code if hasattr(response, 'status_code') else None)

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Silvert Supply Co. API Testing...")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        self.test_auth_endpoints()
        self.test_product_endpoints()
        self.test_search_endpoints()
        self.test_cart_endpoints()
        self.test_order_endpoints()
        self.test_admin_endpoints()
        self.test_unauthorized_access()
        
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests ({len(self.failed_tests)}):")
            for test in self.failed_tests:
                print(f"  • {test['test']}: {test['details']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = SilvertAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())