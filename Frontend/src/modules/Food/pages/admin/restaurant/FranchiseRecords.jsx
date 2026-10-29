import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Package,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Users,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Plus,
  FileText,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import { adminAPI } from '@food/api';
import { toast } from 'sonner';
import FranchiseManagementModal from '@food/components/admin/restaurants/FranchiseManagementModal';

export default function FranchiseRecords() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('outlets'); // 'outlets' | 'stocks' | 'reports'
  const [data, setData] = useState({
    summary: {
      totalFranchises: 0,
      activeFranchises: 0,
      totalStockItems: 0,
      totalLowStockAlerts: 0,
      totalCounterSales: 0,
      totalOnlineSales: 0,
      totalFootfall: 0,
    },
    outlets: [],
    stocks: [],
    reports: [],
  });

  // Modal State
  const [selectedOutletForModal, setSelectedOutletForModal] = useState(null);

  // Filters
  const [selectedOutletFilter, setSelectedOutletFilter] = useState('ALL');
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getAllFranchiseRecords();
      if (res?.data?.success) {
        setData(res.data.data);
      } else {
        toast.error('Failed to load franchise records');
      }
    } catch (err) {
      console.error('Error fetching franchise records:', err);
      toast.error('Error loading franchise records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Filtered stocks
  const filteredStocks = useMemo(() => {
    let list = data.stocks || [];
    if (selectedOutletFilter !== 'ALL') {
      list = list.filter(
        (s) => String(s.restaurantId?._id || s.restaurantId) === selectedOutletFilter
      );
    }
    if (onlyLowStock) {
      list = list.filter((s) => s.isLowStock);
    }
    if (stockSearchQuery.trim()) {
      const q = stockSearchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.itemName?.toLowerCase().includes(q) ||
          s.category?.toLowerCase().includes(q) ||
          s.restaurantId?.restaurantName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data.stocks, selectedOutletFilter, onlyLowStock, stockSearchQuery]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    let list = data.reports || [];
    if (selectedOutletFilter !== 'ALL') {
      list = list.filter(
        (r) => String(r.restaurantId?._id || r.restaurantId) === selectedOutletFilter
      );
    }
    return list;
  }, [data.reports, selectedOutletFilter]);

  const summary = data.summary || {};

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Building2 className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-neutral-900">
              Franchise Records & Central Stock
            </h1>
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            Consolidated overview of all franchise outlets, raw material allocations, and daily shift audit reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top 5 Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Outlets */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Franchise Outlets
            </span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Building2 className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 mt-3">
            {summary.totalFranchises || 0}
          </p>
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{summary.activeFranchises || 0} Active Branches</span>
          </p>
        </div>

        {/* Stock Items */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Stock Items
            </span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Package className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 mt-3">
            {summary.totalStockItems || 0}
          </p>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Allocated raw materials
          </p>
        </div>

        {/* Low Stock Alerts */}
        <div
          onClick={() => {
            setActiveTab('stocks');
            setOnlyLowStock(true);
          }}
          className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            summary.totalLowStockAlerts > 0
              ? 'bg-amber-50/50 border-amber-300 hover:bg-amber-100/50'
              : 'bg-white border-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Low Stock Alerts
            </span>
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-amber-900 mt-3">
            {summary.totalLowStockAlerts || 0}
          </p>
          <p className="text-xs text-amber-700 mt-1 font-medium">
            {summary.totalLowStockAlerts > 0 ? '⚠️ Immediate Restock Needed' : 'All Stock Healthy'}
          </p>
        </div>

        {/* Counter Sales */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Counter Revenue
            </span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 mt-3">
            ₹{Number(summary.totalCounterSales || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">
            Reported walk-in dine-in / cash
          </p>
        </div>

        {/* Total Footfall */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Total Footfall
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="w-5 h-5" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-neutral-900 mt-3">
            {Number(summary.totalFootfall || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Walk-in customer volume
          </p>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('outlets')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
              activeTab === 'outlets'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Franchise Outlets</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
              {data.outlets?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('stocks')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
              activeTab === 'stocks'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Consolidated Stock</span>
            {summary.totalLowStockAlerts > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-bold">
                {summary.totalLowStockAlerts} low
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Daily Shift Reports</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-neutral-100 text-neutral-700">
              {data.reports?.length || 0}
            </span>
          </button>
        </div>

        {/* Global Outlet Filter Dropdown */}
        {(activeTab === 'stocks' || activeTab === 'reports') && (
          <div className="flex items-center gap-2 pb-2">
            <Filter className="w-4 h-4 text-neutral-400" />
            <select
              value={selectedOutletFilter}
              onChange={(e) => setSelectedOutletFilter(e.target.value)}
              className="text-sm bg-white border border-neutral-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="ALL">All Franchise Outlets</option>
              {data.outlets?.map((outlet) => (
                <option key={outlet._id} value={outlet._id}>
                  {outlet.restaurantName || outlet.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: OUTLETS OVERVIEW */}
      {activeTab === 'outlets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.outlets?.length === 0 ? (
            <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-neutral-200">
              <Building2 className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-neutral-800">No Franchise Outlets Configured</h3>
              <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
                Set restaurant type to 'franchise' in Restaurants Management to enable central stock control and shift audits.
              </p>
            </div>
          ) : (
            data.outlets?.map((outlet) => {
              const stockStats = outlet.stockStats || {};
              const reportStats = outlet.reportStats || {};

              return (
                <div
                  key={outlet._id}
                  className="bg-white rounded-2xl border border-neutral-200 hover:border-purple-300 transition-all shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-purple-100 text-purple-700 uppercase tracking-wider">
                            Franchise
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
                              outlet.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            {outlet.status || 'Active'}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-neutral-900 mt-1.5">
                          {outlet.restaurantName || outlet.name}
                        </h3>
                        <p className="text-xs text-neutral-500">
                          {outlet.phone || 'No phone'} &bull; {outlet.address?.city || 'Indore'}
                        </p>
                      </div>

                      {outlet.hasLowStock && (
                        <span
                          className="p-1.5 rounded-lg bg-amber-100 text-amber-700"
                          title="Contains low stock items"
                        >
                          <AlertTriangle className="w-5 h-5" />
                        </span>
                      )}
                    </div>

                    {/* Stock & Report Metrics */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100">
                      <div className="p-3 bg-neutral-50 rounded-xl">
                        <span className="text-xs text-neutral-500 font-medium">Stock Inventory</span>
                        <p className="text-base font-bold text-neutral-900 mt-0.5">
                          {stockStats.totalItems || 0} Items
                        </p>
                        <span
                          className={`text-xs font-semibold ${
                            stockStats.lowStockCount > 0 ? 'text-amber-600' : 'text-green-600'
                          }`}
                        >
                          {stockStats.lowStockCount > 0
                            ? `⚠️ ${stockStats.lowStockCount} items low`
                            : '✓ Adequate stock'}
                        </span>
                      </div>

                      <div className="p-3 bg-neutral-50 rounded-xl">
                        <span className="text-xs text-neutral-500 font-medium">Counter Revenue</span>
                        <p className="text-base font-bold text-neutral-900 mt-0.5">
                          ₹{Number(reportStats.totalCounterSales || 0).toLocaleString('en-IN')}
                        </p>
                        <span className="text-xs text-neutral-500">
                          {reportStats.reportCount || 0} shifts logged
                        </span>
                      </div>
                    </div>

                    {/* Last Report Info */}
                    {reportStats.latestReport && (
                      <div className="text-xs text-neutral-500 flex items-center justify-between bg-purple-50/50 p-2.5 rounded-xl border border-purple-100">
                        <span className="flex items-center gap-1 text-purple-900 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          Last Report:
                        </span>
                        <span className="text-purple-700 font-semibold">
                          {new Date(reportStats.latestReport.reportDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedOutletForModal(outlet)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer"
                    >
                      <Package className="w-4 h-4" />
                      <span>Manage Stock & Reports</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: CONSOLIDATED STOCK INVENTORY */}
      {activeTab === 'stocks' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search raw material, spices, packaging..."
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-neutral-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyLowStock}
                  onChange={(e) => setOnlyLowStock(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <span className="font-semibold text-amber-800">Show only low stock items</span>
              </label>

              <span className="text-xs text-neutral-500">
                Showing <b>{filteredStocks.length}</b> stock records
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-neutral-50/80 border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="py-3 px-4 font-semibold">Raw Material / Item</th>
                  <th className="py-3 px-4 font-semibold">Franchise Outlet</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Current Stock</th>
                  <th className="py-3 px-4 font-semibold">Safety Alert</th>
                  <th className="py-3 px-4 font-semibold">Unit Cost</th>
                  <th className="py-3 px-4 font-semibold">Last Supplied</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-neutral-500">
                      <Package className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                      <p className="font-medium text-neutral-700">No stock records found</p>
                      <p className="text-xs text-neutral-400 mt-0.5">Try adjusting your search or filters.</p>
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock) => (
                    <tr
                      key={stock._id}
                      className={`hover:bg-neutral-50/60 transition-colors ${
                        stock.isLowStock ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-semibold text-neutral-900">
                        <div className="flex items-center gap-2">
                          {stock.isLowStock && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                          <span>{stock.itemName}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-neutral-700">
                        <span className="font-medium">
                          {stock.restaurantId?.restaurantName || stock.restaurantId?.name || 'Unknown Outlet'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-neutral-600">
                        <span className="px-2 py-0.5 rounded-md text-xs bg-neutral-100 text-neutral-700 font-medium">
                          {stock.category || 'General'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`font-bold text-sm ${
                            stock.isLowStock ? 'text-amber-700' : 'text-neutral-900'
                          }`}
                        >
                          {stock.currentStock} {stock.unit}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            stock.isLowStock
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {stock.isLowStock ? `Low (<= ${stock.minimumThreshold})` : `Healthy (> ${stock.minimumThreshold})`}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-neutral-700">
                        {stock.costPerUnit > 0 ? `₹${stock.costPerUnit}/${stock.unit}` : '—'}
                      </td>

                      <td className="py-3 px-4 text-xs text-neutral-500">
                        {stock.lastSuppliedQuantity > 0 ? (
                          <div>
                            <span className="font-medium text-neutral-700">
                              +{stock.lastSuppliedQuantity} {stock.unit}
                            </span>
                            <br />
                            <span className="text-neutral-400">
                              {new Date(stock.lastSuppliedAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            const foundOutlet = data.outlets?.find(
                              (o) => String(o._id) === String(stock.restaurantId?._id || stock.restaurantId)
                            );
                            if (foundOutlet) setSelectedOutletForModal(foundOutlet);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                        >
                          Restock
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ALL DAILY SHIFT REPORTS */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-neutral-900 text-base">
                Daily Sales & Shift Consumption Reports
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Audit records submitted by franchise managers showing walk-in revenue and raw materials used.
              </p>
            </div>
            <span className="text-xs text-neutral-500">
              Total Reports: <b>{filteredReports.length}</b>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-neutral-50/80 border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="py-3 px-4 font-semibold">Report Date</th>
                  <th className="py-3 px-4 font-semibold">Franchise Outlet</th>
                  <th className="py-3 px-4 font-semibold">Counter Sales</th>
                  <th className="py-3 px-4 font-semibold">Online Sales</th>
                  <th className="py-3 px-4 font-semibold">Total Revenue</th>
                  <th className="py-3 px-4 font-semibold">Footfall</th>
                  <th className="py-3 px-4 font-semibold">Submitted By</th>
                  <th className="py-3 px-4 font-semibold text-right">Stock Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-neutral-500">
                      <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                      <p className="font-medium text-neutral-700">No shift reports submitted yet</p>
                      <p className="text-xs text-neutral-400 mt-0.5">Reports submitted by franchise managers will appear here.</p>
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => {
                    const isExpanded = expandedReportId === report._id;

                    return (
                      <React.Fragment key={report._id}>
                        <tr className="hover:bg-neutral-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-neutral-900">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-purple-600" />
                              <span>
                                {new Date(report.reportDate).toLocaleDateString('en-IN', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-medium text-neutral-800">
                            {report.restaurantId?.restaurantName || report.restaurantId?.name || 'Unknown Outlet'}
                          </td>

                          <td className="py-3.5 px-4 font-bold text-emerald-700">
                            ₹{Number(report.counterSalesAmount || 0).toLocaleString('en-IN')}
                          </td>

                          <td className="py-3.5 px-4 text-blue-700 font-semibold">
                            ₹{Number(report.onlineSalesAmount || 0).toLocaleString('en-IN')}
                          </td>

                          <td className="py-3.5 px-4 font-extrabold text-neutral-900">
                            ₹{Number(report.totalSalesAmount || (report.counterSalesAmount + report.onlineSalesAmount) || 0).toLocaleString('en-IN')}
                          </td>

                          <td className="py-3.5 px-4 text-neutral-700">
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-neutral-400" />
                              <b>{report.customerFootfall || 0}</b> persons
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-xs text-neutral-500">
                            {report.submittedBy || 'Franchise Holder'}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setExpandedReportId(isExpanded ? null : report._id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer"
                            >
                              <span>{report.stockUsage?.length || 0} Items</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Stock Usage Sub-table */}
                        {isExpanded && (
                          <tr className="bg-purple-50/30">
                            <td colSpan="8" className="p-4 sm:p-6">
                              <div className="bg-white p-4 rounded-xl border border-purple-200 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-purple-600" />
                                    <span>Raw Materials Consumed on Shift ({report.stockUsage?.length || 0})</span>
                                  </h4>
                                  {report.notes && (
                                    <span className="text-xs text-neutral-600 italic">
                                      Manager Note: "{report.notes}"
                                    </span>
                                  )}
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                      <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                                        <th className="p-2">Item Name</th>
                                        <th className="p-2">Opening Stock</th>
                                        <th className="p-2 text-purple-700">Quantity Used</th>
                                        <th className="p-2 text-amber-700">Wasted / Damaged</th>
                                        <th className="p-2 font-bold">Closing Balance</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                      {report.stockUsage?.map((u, idx) => (
                                        <tr key={idx} className="hover:bg-neutral-50">
                                          <td className="p-2 font-semibold text-neutral-900">{u.itemName}</td>
                                          <td className="p-2 text-neutral-600">{u.openingStock} {u.unit}</td>
                                          <td className="p-2 font-bold text-purple-800">-{u.quantityUsed} {u.unit}</td>
                                          <td className="p-2 text-amber-800 font-semibold">{u.wastedQuantity > 0 ? `-${u.wastedQuantity} ${u.unit}` : '0'}</td>
                                          <td className="p-2 font-extrabold text-neutral-900">{u.closingStock} {u.unit}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Franchise Modal for Stock Allocation & Reports */}
      {selectedOutletForModal && (
        <FranchiseManagementModal
          isOpen={Boolean(selectedOutletForModal)}
          onClose={() => {
            setSelectedOutletForModal(null);
            fetchRecords();
          }}
          restaurant={selectedOutletForModal}
        />
      )}
    </div>
  );
}
