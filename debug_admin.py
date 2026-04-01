#!/usr/bin/env python3
"""
Simple admin token test to debug the issue
"""

import requests
import json

def test_admin_token():
    base_url = "https://bulk-chef-hub.preview.emergentagent.com"
    
    # Test 1: Login and get token
    print("1. Testing admin login...")
    login_response = requests.post(
        f"{base_url}/api/auth/login",
        json={"email": "admin@silvert.com", "password": "SilvertAdmin2024!"},
        headers={"Content-Type": "application/json"}
    )
    
    if login_response.status_code == 200:
        login_data = login_response.json()
        admin_token = login_data['access_token']
        login_role = login_data['user']['role']
        print(f"   ✅ Login successful, role: {login_role}")
        print(f"   Token: {admin_token[:50]}...")
    else:
        print(f"   ❌ Login failed: {login_response.status_code}")
        return
    
    # Test 2: Use token with /auth/me
    print("\n2. Testing /auth/me with admin token...")
    me_response = requests.get(
        f"{base_url}/api/auth/me",
        headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
    )
    
    if me_response.status_code == 200:
        me_data = me_response.json()
        me_role = me_data['user']['role']
        print(f"   ✅ /auth/me successful, role: {me_role}")
        
        if me_role != login_role:
            print(f"   ⚠️  Role mismatch! Login: {login_role}, /auth/me: {me_role}")
        else:
            print(f"   ✅ Role consistent: {me_role}")
    else:
        print(f"   ❌ /auth/me failed: {me_response.status_code}")
        print(f"   Response: {me_response.text}")
        return
    
    # Test 3: Use token with admin endpoint
    print("\n3. Testing admin endpoint...")
    admin_response = requests.get(
        f"{base_url}/api/admin/analytics",
        headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }
    )
    
    if admin_response.status_code == 200:
        print(f"   ✅ Admin endpoint successful")
    else:
        print(f"   ❌ Admin endpoint failed: {admin_response.status_code}")
        print(f"   Response: {admin_response.text}")

if __name__ == "__main__":
    test_admin_token()