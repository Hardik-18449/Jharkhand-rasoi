import React, { useState, useEffect } from 'react';
import {
  Package,
  TrendingUp,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  FileText,
  DollarSign,
  ChevronRight,
  Info,
} from 'lucide-react';
import { restaurantAPI } from '@food/api';
import { toast } from 'sonner';

export default function FranchiseOperations() {
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'submit' | 'history'
  const [stocks, setStocks] = useState([]);
  const [reports, setReports] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [counterSalesAmount, setCounterSalesAmount] = useState('');
  const [onlineSalesAmount, setOnlineSalesAmount] = useState('');
  const [customerFootfall, setCustomerFootfall] = useState('');
  const [notes, setNotes] = useState('');
  const [stockUsageInputs, setStockUsageInputs] = useState({});

  const fetchStock = async () => {
    setLoadingStocks(true);
    try {
      const res = await restaurantAPI.getFranchiseStock();
      if (res?.data?.success) {
        const list = res.data.data?.stocks || [];
        setStocks(list);

        // Pre-fill usage inputs with opening stock
        const initialInputs = {};
        list.forEach((item) => {
          initialInputs[item._id] = {
            used: '',
            wasted: '',
            opening: Number(item.currentStock || 0),
          };
        });
        setStockUsageInputs(initialInputs);
      }
    } catch (err) {
      console.error('Failed to fetch franchise stock:', err);
      toast.error('Failed to load stock inventory');
    } finally {
      setLoadingStocks(false);
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await restaurantAPI.getFranchiseDailyReports();
      if (res?.data?.success) {
        setReports(res.data.data?.reports || []);
      }
    } catch (err) {
      console.error('Failed to fetch daily reports:', err);
      toast.error('Failed to load past reports');
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchStock();
    fetchReports();
  }, []);

  const handleUsageChange = (stockId, field, val) => {
    setStockUsageInputs((prev) => ({
      ...prev,
      [stockId]: {
        ...prev[stockId],
        [field]: val,
      },
    }));
  };

  const handleSubmitDailyReport = async (e) => {
    e.preventDefault();
    if (!counterSalesAmount && Number(counterSalesAmount) !== 0) {
      toast.error('Please enter counter/offline sales amount (enter 0 if none)');
      return;
    }

    setSubmitting(true);
    try {
      const stockUsage = stocks.map((item) => {
        const inp = stockUsageInputs[item._id] || {};
        const opening = Number(item.currentStock || 0);
        const used = Math.max(0, Number(inp.used || 0));
        const wasted = Math.max(0, Number(inp.wasted || 0));
        const closing = Math.max(0, opening - used - wasted);

        return {
          stockId: item._id,
          itemName: item.itemName,
          unit: item.unit,
          openingStock: opening,
          quantityUsed: used,
          wastedQuantity: wasted,
          closingStock: closing,
        };
      });

      const payload = {
        reportDate,
        counterSalesAmount: Number(counterSalesAmount || 0),
        onlineSalesAmount: Number(onlineSalesAmount || 0),
        customerFootfall: Number(customerFootfall || 0),
        notes,
        stockUsage,
      };

      const res = await restaurantAPI.submitFranchiseDailyReport(payload);
      if (res?.data?.success) {
        toast.success('Daily sales and stock usage report submitted successfully!');
        // Reset form
        setCounterSalesAmount('');
        setOnlineSalesAmount('');
        setCustomerFootfall('');
        setNotes('');
        // Refresh stock & reports
        await fetchStock();
        await fetchReports();
        setActiveTab('history');
      } else {
        toast.error(res?.data?.message || 'Failed to submit report');
      }
    } catch (err) {
      console.error('Report submission error:', err);
      toast.error(err?.response?.data?.message || 'Failed to submit daily report');
    } finally {
      setSubmitting(false);
    }
  };

  const lowStockCount = stocks.filter((s) => s.isLowStock).length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-purple-700/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-purple-200 mb-2">
              <Package className="w-3.5 h-3.5" />
              <span>Franchise Operations Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Franchise Stock & Daily Sales</h1>
            <p className="text-purple-200 text-sm mt-1 max-w-xl">
              Track raw inventory supplied by Admin and update your end-of-day sales, consumption, and wastage.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchStock();
                fetchReports();
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <span className="text-xs text-purple-200 block">Total Stock Items</span>
            <span className="text-xl font-bold text-white mt-1 block">{stocks.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <span className="text-xs text-purple-200 block">Low Stock Alerts</span>
            <span className={`text-xl font-bold mt-1 block ${lowStockCount > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
              {lowStockCount} Items
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <span className="text-xs text-purple-200 block">Reports Submitted</span>
            <span className="text-xl font-bold text-white mt-1 block">{reports.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <span className="text-xs text-purple-200 block">Admin Supply Mode</span>
            <span className="text-sm font-semibold text-emerald-300 mt-1 block">Active</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'stock'
              ? 'border-purple-600 text-purple-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Stock Inventory ({stocks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('submit')}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'submit'
              ? 'border-purple-600 text-purple-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Submit Daily Report</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'border-purple-600 text-purple-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Report History ({reports.length})</span>
        </button>
      </div>

      {/* TAB 1: Stock Inventory */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <span className="font-semibold">Admin Stock Allocation: </span>
              These raw materials and ingredients are allocated and delivered by the Jharkhand Rasoi central hub. If any item is low, contact the central admin to replenish stock.
            </div>
          </div>

          {loadingStocks ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading stock inventory...</p>
            </div>
          ) : stocks.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-800">No stock allocated yet</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">
                Your franchise outlet does not have any stock allocated by the Admin yet. Please reach out to the Admin team.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                    <tr>
                      <th className="py-3.5 px-4">Item Name</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Current Balance</th>
                      <th className="py-3.5 px-4">Min. Threshold</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Last Supplied</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stocks.map((item) => (
                      <tr key={item._id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-gray-900">{item.itemName}</td>
                        <td className="py-3.5 px-4 text-gray-600">{item.category || 'General'}</td>
                        <td className="py-3.5 px-4 font-bold text-gray-800">
                          {item.currentStock} {item.unit}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500">
                          {item.minimumThreshold} {item.unit}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.isLowStock ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" />
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 text-xs">
                          {item.lastSuppliedAt ? new Date(item.lastSuppliedAt).toLocaleDateString() : 'N/A'}{' '}
                          {item.lastSuppliedQuantity ? `(+${item.lastSuppliedQuantity} ${item.unit})` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Submit Daily Report */}
      {activeTab === 'submit' && (
        <form onSubmit={handleSubmitDailyReport} className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <span>1. Daily Sales Summary</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Report Date *</label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Offline / Counter Sales (₹) *
                </label>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  value={counterSalesAmount}
                  onChange={(e) => setCounterSalesAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Online App Sales (₹) (Optional)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  value={onlineSalesAmount}
                  onChange={(e) => setOnlineSalesAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Estimated Customer Footfall (Optional)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 45"
                  min="0"
                  value={customerFootfall}
                  onChange={(e) => setCustomerFootfall(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Stock Usage Table */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              <span>2. Raw Material / Stock Usage</span>
            </h2>

            {stocks.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No stock items found. You can submit sales without stock deduction or wait until admin assigns stock items.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                    <tr>
                      <th className="py-3 px-3">Item Name</th>
                      <th className="py-3 px-3">Opening Stock</th>
                      <th className="py-3 px-3">Quantity Used Today</th>
                      <th className="py-3 px-3">Wasted / Spoilage</th>
                      <th className="py-3 px-3">Estimated Closing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stocks.map((item) => {
                      const inp = stockUsageInputs[item._id] || {};
                      const opening = Number(item.currentStock || 0);
                      const used = Number(inp.used || 0);
                      const wasted = Number(inp.wasted || 0);
                      const closing = Math.max(0, opening - used - wasted);

                      return (
                        <tr key={item._id}>
                          <td className="py-3 px-3 font-semibold text-gray-900">
                            {item.itemName} <span className="text-xs text-gray-500">({item.unit})</span>
                          </td>
                          <td className="py-3 px-3 text-gray-700 font-medium">
                            {opening} {item.unit}
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="number"
                              min="0"
                              max={opening}
                              step="0.1"
                              placeholder="0"
                              value={inp.used || ''}
                              onChange={(e) => handleUsageChange(item._id, 'used', e.target.value)}
                              className="w-28 px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              placeholder="0"
                              value={inp.wasted || ''}
                              onChange={(e) => handleUsageChange(item._id, 'wasted', e.target.value)}
                              className="w-28 px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-3 px-3 font-bold text-gray-800">
                            {closing} {item.unit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Remarks / Day Notes (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Mention any shortage, equipment issue, customer feedback, or stock requirement..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-xl text-sm transition-all shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Submitting Report...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Daily Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: Report History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {loadingReports ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">No daily reports submitted yet</p>
              <p className="text-xs text-gray-500 mt-1">Submit your first daily sales & stock report above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Report Date</th>
                    <th className="py-3.5 px-4">Counter Sales</th>
                    <th className="py-3.5 px-4">Online Sales</th>
                    <th className="py-3.5 px-4">Total Sales</th>
                    <th className="py-3.5 px-4">Items Used</th>
                    <th className="py-3.5 px-4">Notes</th>
                    <th className="py-3.5 px-4">Submitted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reports.map((rep) => (
                    <tr key={rep._id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        {new Date(rep.reportDate).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700">
                        ₹{Number(rep.counterSalesAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        ₹{Number(rep.onlineSalesAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-purple-700">
                        ₹{Number(rep.totalSalesAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {Array.isArray(rep.stockUsage) ? (
                          <div className="text-xs space-y-1">
                            {rep.stockUsage.slice(0, 3).map((u, i) => (
                              <div key={i}>
                                {u.itemName}: <span className="font-semibold">{u.quantityUsed} {u.unit}</span>
                              </div>
                            ))}
                            {rep.stockUsage.length > 3 && (
                              <span className="text-gray-400">+{rep.stockUsage.length - 3} more</span>
                            )}
                          </div>
                        ) : (
                          'None'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500 max-w-xs truncate">
                        {rep.notes || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-400">
                        {new Date(rep.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
