import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  DollarSign,
  Building2,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { adminAPI } from '@food/api';
import { toast } from 'sonner';

export default function FranchiseManagementModal({ isOpen, onClose, restaurant }) {
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'reports'
  const [stocks, setStocks] = useState([]);
  const [reports, setReports] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [showAllocateForm, setShowAllocateForm] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    itemName: '',
    category: 'Raw Material',
    unit: 'kg',
    quantity: '',
    minimumThreshold: '5',
    costPerUnit: '',
    notes: '',
  });

  const restaurantId = restaurant?.id || restaurant?._id;

  const fetchStock = async () => {
    if (!restaurantId) return;
    setLoadingStocks(true);
    try {
      const res = await adminAPI.getFranchiseStock(restaurantId);
      if (res?.data?.success) {
        setStocks(res.data.data?.stocks || []);
      }
    } catch (err) {
      console.error('Failed to load franchise stock:', err);
      toast.error('Failed to load stock inventory');
    } finally {
      setLoadingStocks(false);
    }
  };

  const fetchReports = async () => {
    if (!restaurantId) return;
    setLoadingReports(true);
    try {
      const res = await adminAPI.getFranchiseReports(restaurantId);
      if (res?.data?.success) {
        setReports(res.data.data?.reports || []);
      }
    } catch (err) {
      console.error('Failed to load daily reports:', err);
      toast.error('Failed to load daily reports');
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (isOpen && restaurantId) {
      fetchStock();
      fetchReports();
    }
  }, [isOpen, restaurantId]);

  if (!isOpen || !restaurant) return null;

  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.itemName.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (!formData.quantity || Number(formData.quantity) <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    setAllocating(true);
    try {
      const payload = {
        itemName: formData.itemName.trim(),
        category: formData.category,
        unit: formData.unit,
        quantity: Number(formData.quantity),
        minimumThreshold: Number(formData.minimumThreshold || 5),
        costPerUnit: Number(formData.costPerUnit || 0),
        notes: formData.notes.trim(),
      };

      const res = await adminAPI.allocateFranchiseStock(restaurantId, payload);
      if (res?.data?.success) {
        toast.success(`Supplied ${formData.quantity} ${formData.unit} of "${formData.itemName}" successfully!`);
        setFormData({
          itemName: '',
          category: 'Raw Material',
          unit: 'kg',
          quantity: '',
          minimumThreshold: '5',
          costPerUnit: '',
          notes: '',
        });
        setShowAllocateForm(false);
        await fetchStock();
      } else {
        toast.error(res?.data?.message || 'Failed to allocate stock');
      }
    } catch (err) {
      console.error('Allocate stock error:', err);
      toast.error(err?.response?.data?.message || 'Failed to allocate stock');
    } finally {
      setAllocating(false);
    }
  };

  const handleRemoveStock = async (stockId, itemName) => {
    if (!confirm(`Are you sure you want to remove "${itemName}" from this franchise?`)) return;
    try {
      const res = await adminAPI.removeFranchiseStock(restaurantId, stockId);
      if (res?.data?.success) {
        toast.success(`Removed ${itemName}`);
        setStocks((prev) => prev.filter((s) => s._id !== stockId));
      }
    } catch (err) {
      toast.error('Failed to remove stock item');
    }
  };

  const lowStockCount = stocks.filter((s) => s.isLowStock).length;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-purple-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{restaurant.name || restaurant.restaurantName}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-400/20 text-purple-200 border border-purple-400/30">
                  Franchise Outlet
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">
                Owner: {restaurant.ownerName} ({restaurant.ownerPhone}) • Zone: {restaurant.zone || 'N/A'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 pt-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('stock')}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-all cursor-pointer ${
                activeTab === 'stock'
                  ? 'border-purple-600 text-purple-700 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Stock Inventory ({stocks.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm border-b-2 transition-all cursor-pointer ${
                activeTab === 'reports'
                  ? 'border-purple-600 text-purple-700 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Daily Sales & Usage Reports ({reports.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={() => {
                fetchStock();
                fetchReports();
              }}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs flex items-center gap-1.5 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            {activeTab === 'stock' && (
              <button
                onClick={() => setShowAllocateForm((p) => !p)}
                className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAllocateForm ? 'Cancel Form' : 'Supply New Stock'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: Stock Inventory */}
          {activeTab === 'stock' && (
            <div className="space-y-4">
              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <span className="text-xs text-purple-700 block">Total Stock Items</span>
                  <span className="text-lg font-bold text-purple-900 mt-0.5 block">{stocks.length}</span>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <span className="text-xs text-amber-700 block">Low Stock Alerts</span>
                  <span className="text-lg font-bold text-amber-900 mt-0.5 block">{lowStockCount} Items</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 col-span-2 sm:col-span-1">
                  <span className="text-xs text-emerald-700 block">Franchise Status</span>
                  <span className="text-sm font-semibold text-emerald-800 mt-0.5 block">Active Outlet</span>
                </div>
              </div>

              {/* Allocate Form */}
              {showAllocateForm && (
                <form
                  onSubmit={handleAllocateSubmit}
                  className="bg-slate-50 border border-purple-200 rounded-xl p-4 space-y-4 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Plus className="w-4 h-4 text-purple-600" />
                      <span>Allocate / Supply Stock to Franchise</span>
                    </h4>
                    <span className="text-xs text-slate-500">Admin Dispatch</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Basmati Rice, Paneer, Oil"
                        value={formData.itemName}
                        onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="Raw Material">Raw Material</option>
                        <option value="Dairy">Dairy</option>
                        <option value="Meat / Poultry">Meat / Poultry</option>
                        <option value="Spices & Gravy">Spices & Gravy</option>
                        <option value="Packaging">Packaging</option>
                        <option value="Beverages">Beverages</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="kg">kg (Kilograms)</option>
                        <option value="litre">litre (Litres)</option>
                        <option value="packet">packet (Packets)</option>
                        <option value="box">box (Boxes)</option>
                        <option value="piece">piece (Pieces)</option>
                        <option value="gram">gram (Grams)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity to Supply *</label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        placeholder="e.g. 50"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Min. Alert Threshold</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="5"
                        value={formData.minimumThreshold}
                        onChange={(e) => setFormData({ ...formData, minimumThreshold: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Per Unit (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Optional"
                        value={formData.costPerUnit}
                        onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Supply Notes / Invoice #</label>
                    <input
                      type="text"
                      placeholder="e.g. Batch #401 dispatched via central warehouse van"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAllocateForm(false)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={allocating}
                      className="px-5 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                    >
                      {allocating ? 'Supplying...' : 'Supply Stock'}
                    </button>
                  </div>
                </form>
              )}

              {/* Stocks Table */}
              {loadingStocks ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-xs text-slate-500 mt-2">Loading stock inventory...</p>
                </div>
              ) : stocks.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Package className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">No stock allocated to this franchise</p>
                  <p className="text-xs text-slate-500 mt-1">Click "Supply New Stock" above to allocate raw materials.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs">
                      <tr>
                        <th className="py-3 px-3">Item Name</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Current Balance</th>
                        <th className="py-3 px-3">Min. Alert</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Last Supplied</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {stocks.map((item) => (
                        <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-3 font-semibold text-slate-900">{item.itemName}</td>
                          <td className="py-3 px-3 text-slate-500">{item.category || 'General'}</td>
                          <td className="py-3 px-3 font-bold text-slate-800">
                            {item.currentStock} {item.unit}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {item.minimumThreshold} {item.unit}
                          </td>
                          <td className="py-3 px-3">
                            {item.isLowStock ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {item.lastSuppliedAt ? new Date(item.lastSuppliedAt).toLocaleDateString() : 'N/A'}{' '}
                            {item.lastSuppliedQuantity ? `(+${item.lastSuppliedQuantity} ${item.unit})` : ''}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleRemoveStock(item._id, item.itemName)}
                              className="p-1 rounded text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Daily Sales & Usage Reports */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              {loadingReports ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-xs text-slate-500 mt-2">Loading reports...</p>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">No daily reports submitted yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    The franchise holder will update end-of-day sales and stock usage from their restaurant dashboard.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((rep) => {
                    const isExpanded = expandedReportId === rep._id;
                    return (
                      <div
                        key={rep._id}
                        className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 hover:border-purple-200 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">
                              {new Date(rep.reportDate).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                              Submitted
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <div>
                              <span className="text-slate-500">Counter Sales: </span>
                              <span className="font-bold text-emerald-700">
                                ₹{Number(rep.counterSalesAmount || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Total Day Sales: </span>
                              <span className="font-extrabold text-purple-700">
                                ₹{Number(rep.totalSalesAmount || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <button
                              onClick={() => setExpandedReportId(isExpanded ? null : rep._id)}
                              className="flex items-center gap-1 text-purple-600 font-semibold hover:text-purple-800 transition-colors cursor-pointer"
                            >
                              <span>{isExpanded ? 'Hide Usage' : 'View Usage'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Stock Usage Details */}
                        {isExpanded && (
                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/70 space-y-2 animate-in fade-in duration-150">
                            <h5 className="text-xs font-bold text-slate-700">Stock Consumed & Wastage:</h5>
                            {Array.isArray(rep.stockUsage) && rep.stockUsage.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                {rep.stockUsage.map((u, i) => (
                                  <div key={i} className="bg-white p-2 rounded border border-slate-200">
                                    <div className="flex items-center justify-between font-semibold text-slate-800">
                                      <span>{u.itemName}</span>
                                      <span className="text-purple-700">Used: {u.quantityUsed} {u.unit}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                                      <span>Opening: {u.openingStock} {u.unit}</span>
                                      <span>Wasted: {u.wastedQuantity || 0} {u.unit}</span>
                                      <span>Closing: {u.closingStock} {u.unit}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">No stock deductions recorded for this date.</p>
                            )}

                            {rep.notes && (
                              <div className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                                <span className="font-semibold text-slate-700">Franchise Remarks: </span>
                                {rep.notes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Jharkhand Rasoi • Franchise Stock & Daily Audit
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
