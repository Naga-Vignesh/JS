import { useState, useEffect, useCallback } from "react";
import { Package, ShoppingCart, Users, DollarSign, AlertTriangle, TrendingUp, Edit2, Save, X, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "../lib/api";
import { toast } from "sonner";

function StatCard({ icon: Icon, label, value, sub, color = "text-[#D4AF37]" }) {
  return (
    <div className="bg-[#242424] border border-white/10 rounded-sm p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/5 rounded-sm">
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div>
          <p className="text-[10px] text-white/40 tracking-widest">{label}</p>
          <p className="text-xl font-mono font-bold text-white">{value}</p>
          {sub && <p className="text-[10px] text-white/30">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStock, setEditingStock] = useState({});
  const [statusFilter, setStatusFilter] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [analyticsRes, ordersRes, customersRes, inventoryRes] = await Promise.all([
        api.get("/admin/analytics"),
        api.get(`/admin/orders?limit=50${statusFilter ? `&status=${statusFilter}` : ""}`),
        api.get("/admin/customers"),
        api.get("/admin/inventory"),
      ]);
      setAnalytics(analyticsRes.data);
      setOrders(ordersRes.data.orders || []);
      setCustomers(customersRes.data.customers || []);
      setInventory(inventoryRes.data.products || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateOrderStatus = async (orderId, status) => {
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status });
      toast.success("Order status updated");
      fetchAll();
    } catch { toast.error("Failed to update"); }
  };

  const updateStock = async (productId) => {
    const qty = editingStock[productId];
    if (qty === undefined) return;
    try {
      await api.put(`/admin/inventory/${productId}`, { stock_quantity: parseInt(qty) });
      toast.success("Stock updated");
      setEditingStock((p) => { const n = { ...p }; delete n[productId]; return n; });
      fetchAll();
    } catch { toast.error("Failed to update"); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const chartData = analytics?.daily_stats?.slice(0, 14).reverse().map((d) => ({
    date: d._id?.slice(5) || "",
    orders: d.count,
    revenue: d.revenue
  })) || [];

  return (
    <div className="bg-[#1A1A1A] min-h-screen" data-testid="admin-dashboard">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-black text-white mb-6" style={{ fontFamily: 'Chivo' }}>Admin Dashboard</h1>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-[#242424] border border-white/10 p-1 h-auto">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1A1A1A] rounded-sm px-4 py-1.5" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1A1A1A] rounded-sm px-4 py-1.5" data-testid="tab-orders">Orders</TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1A1A1A] rounded-sm px-4 py-1.5" data-testid="tab-inventory">Inventory</TabsTrigger>
            <TabsTrigger value="customers" className="text-xs data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#1A1A1A] rounded-sm px-4 py-1.5" data-testid="tab-customers">Customers</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={DollarSign} label="REVENUE" value={`$${(analytics?.total_revenue || 0).toLocaleString()}`} />
              <StatCard icon={ShoppingCart} label="ORDERS" value={analytics?.total_orders || 0} />
              <StatCard icon={Users} label="CUSTOMERS" value={analytics?.total_customers || 0} />
              <StatCard icon={Package} label="PRODUCTS" value={analytics?.total_products || 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Alert cards */}
              <div className="space-y-3">
                {analytics?.low_stock_count > 0 && (
                  <div className="bg-orange-600/10 border border-orange-600/20 rounded-sm p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    <div>
                      <p className="text-sm text-orange-400 font-semibold">{analytics.low_stock_count} items low on stock</p>
                      <p className="text-xs text-orange-400/60">Check inventory tab</p>
                    </div>
                  </div>
                )}
                {analytics?.out_of_stock_count > 0 && (
                  <div className="bg-red-600/10 border border-red-600/20 rounded-sm p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <div>
                      <p className="text-sm text-red-400 font-semibold">{analytics.out_of_stock_count} items out of stock</p>
                      <p className="text-xs text-red-400/60">Restock needed</p>
                    </div>
                  </div>
                )}

                {/* Top Products */}
                <div className="bg-[#242424] border border-white/10 rounded-sm p-4">
                  <h3 className="text-xs font-semibold text-white/60 tracking-widest mb-3">TOP PRODUCTS</h3>
                  {analytics?.top_products?.slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-white/30 w-4">{i + 1}.</span>
                        <span className="text-xs text-white truncate max-w-[180px]">{p.name}</span>
                      </div>
                      <span className="font-mono text-xs text-[#D4AF37]">${(p.total_revenue || 0).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 0 && (
                <div className="bg-[#242424] border border-white/10 rounded-sm p-4">
                  <h3 className="text-xs font-semibold text-white/60 tracking-widest mb-3">
                    <TrendingUp className="w-3 h-3 inline mr-1" /> ORDER ACTIVITY
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#666', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: '#2A2A2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, fontSize: 11 }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="orders" fill="#D4AF37" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <div className="flex items-center gap-3 mb-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] bg-[#2A2A2A] border-white/10 text-white text-xs h-8" data-testid="order-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent className="bg-[#2A2A2A] border-white/10">
                  <SelectItem value="all" className="text-white text-xs">All</SelectItem>
                  {["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map((s) => (
                    <SelectItem key={s} value={s} className="text-white text-xs">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-white/30">{orders.length} orders</span>
            </div>
            <div className="border border-white/10 rounded-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 bg-[#242424] hover:bg-[#242424]">
                    <TableHead className="text-white/40 text-[10px] tracking-widest">ORDER</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest">CUSTOMER</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest">ITEMS</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest text-right">TOTAL</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest">STATUS</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest">DATE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.order_id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="font-mono text-xs text-white/60 py-2">{o.order_id}</TableCell>
                      <TableCell className="text-xs text-white py-2">
                        <p>{o.user_name}</p>
                        <p className="text-[10px] text-white/30">{o.company_name}</p>
                      </TableCell>
                      <TableCell className="text-xs text-white/60 py-2">{o.items?.length}</TableCell>
                      <TableCell className="font-mono text-xs text-[#D4AF37] text-right py-2">${o.subtotal?.toFixed(2)}</TableCell>
                      <TableCell className="py-2">
                        <Select value={o.status} onValueChange={(v) => updateOrderStatus(o.order_id, v)}>
                          <SelectTrigger className="h-6 bg-transparent border-white/10 text-[10px] w-[110px]" data-testid={`order-status-${o.order_id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#2A2A2A] border-white/10">
                            {["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map((s) => (
                              <SelectItem key={s} value={s} className="text-white text-[10px]">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-[10px] text-white/30 py-2">{o.created_at?.slice(0, 10)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory">
            <div className="border border-white/10 rounded-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 bg-[#242424] hover:bg-[#242424]">
                    <TableHead className="text-white/40 text-[10px] tracking-widest">SKU</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest">PRODUCT</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest">CATEGORY</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest text-center">STOCK</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest">STATUS</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest text-center">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.map((p) => {
                    const isEditing = editingStock[p.product_id] !== undefined;
                    return (
                      <TableRow key={p.product_id} className="border-white/5 hover:bg-white/[0.02]">
                        <TableCell className="font-mono text-xs text-white/40 py-2">{p.sku}</TableCell>
                        <TableCell className="text-xs text-white py-2">{p.name}</TableCell>
                        <TableCell className="text-xs text-white/40 py-2">{p.category}</TableCell>
                        <TableCell className="text-center py-2">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editingStock[p.product_id]}
                              onChange={(e) => setEditingStock((prev) => ({ ...prev, [p.product_id]: e.target.value }))}
                              className="w-20 h-6 text-xs text-center bg-[#2A2A2A] border-[#D4AF37] mx-auto"
                              data-testid={`stock-input-${p.product_id}`}
                            />
                          ) : (
                            <span className="font-mono text-xs text-white">{p.stock_quantity}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className={`text-[10px] ${
                            p.stock_status === "out_of_stock" ? "bg-red-600/20 text-red-400" :
                            p.stock_status === "low_stock" ? "bg-orange-600/20 text-orange-400" :
                            "bg-[#2E7D32]/20 text-[#4CAF50]"
                          }`}>
                            {p.stock_status?.replace("_", " ").toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center py-2">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => updateStock(p.product_id)} className="p-1 hover:bg-[#2E7D32]/20 rounded" data-testid={`stock-save-${p.product_id}`}>
                                <Save className="w-3.5 h-3.5 text-[#4CAF50]" />
                              </button>
                              <button onClick={() => setEditingStock((prev) => { const n = { ...prev }; delete n[p.product_id]; return n; })} className="p-1 hover:bg-red-500/10 rounded">
                                <X className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setEditingStock((prev) => ({ ...prev, [p.product_id]: p.stock_quantity }))} className="p-1 hover:bg-white/10 rounded" data-testid={`stock-edit-${p.product_id}`}>
                              <Edit2 className="w-3.5 h-3.5 text-white/40" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers">
            <div className="border border-white/10 rounded-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 bg-[#242424] hover:bg-[#242424]">
                    <TableHead className="text-white/40 text-[10px] tracking-widest">NAME</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest">EMAIL</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest">COMPANY</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest">ROLE</TableHead>
                    <TableHead className="text-white/40 text-[10px] tracking-widest">JOINED</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.user_id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="text-xs text-white py-2">{c.name}</TableCell>
                      <TableCell className="text-xs text-white/60 py-2">{c.email}</TableCell>
                      <TableCell className="text-xs text-white/40 py-2">{c.company_name || "—"}</TableCell>
                      <TableCell className="py-2">
                        <Badge className="text-[10px] bg-white/5 text-white/40">{c.role}</Badge>
                      </TableCell>
                      <TableCell className="text-[10px] text-white/30 py-2">{c.created_at?.slice(0, 10)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
