import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchLeads, PAGE_SIZES } from './api'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const formatCurrency = (value) =>
  value === null || value === undefined || value === '' ? '—' : currencyFormatter.format(value)

const formatText = (value) => (value || value === 0 ? String(value) : '—')

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

const formatFlag = (value) => (value ? 'Yes' : 'No')

// Column definitions for the leads table
const COLUMNS = [
  { key: 'date', label: 'Date', render: formatDate },
  { key: 'name', label: 'Name', render: formatText },
  { key: 'contactNo', label: 'Contact No', render: formatText },
  { key: 'paymentEmailId', label: 'Payment Email', render: formatText },
  { key: 'mrp', label: 'MRP', render: formatCurrency },
  { key: 'salePrice', label: 'Sale Price', render: formatCurrency },
  { key: 'amountPaid', label: 'Amount Paid', render: formatCurrency },
  { key: 'balanceLeft', label: 'Balance Left', render: formatCurrency },
  { key: 'paymentType', label: 'Payment Type', render: formatText },
  { key: 'mm', label: 'MM', render: formatText },
  { key: 'paymentMode', label: 'Payment Mode', render: formatText },
  { key: 'paymentId', label: 'Payment ID', render: formatText },
  { key: 'source', label: 'Source', render: formatText },
  { key: 'program', label: 'Program', render: formatText },
  { key: 'status', label: 'Status', render: formatText },
  { key: 'newProgram', label: 'New Program', render: formatText },
  { key: 'onboardingPOC', label: 'Onboarding POC', render: formatText },
  { key: 'onboardingStatus', label: 'Onboarding Status', render: formatText },
  { key: 'onboardingDate', label: 'Onboarding Date', render: formatDate },
  { key: 'remarksOfCall', label: 'Remarks of Call', render: formatText },
  { key: 'partialPaymentStatus', label: 'Partial Payment', render: formatText },
  { key: 'lastDateOfFollowup', label: 'Last Followup', render: formatDate },
  { key: 'refundMonth', label: 'Refund Month', render: formatText },
  { key: 'onboardingStatusCRM', label: 'Onboarding (CRM)', render: formatText },
  { key: 'salesPOC', label: 'Sales POC', render: formatText },
  { key: 'leadOwner', label: 'Lead Owner', render: formatText },
  { key: 'withGST', label: 'With GST', render: formatFlag },
  { key: 'reChurnAndPaid', label: 'Re-churn & Paid', render: formatFlag },
]

function App() {
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]) // load 10 at a time
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const totalPages = Math.max(Math.ceil(total / pageSize), 1)
  const requestIdRef = useRef(0)

  const loadLeads = useCallback(
    async (signal) => {
      const requestId = ++requestIdRef.current
      setLoading(true)
      setError(null)
      try {
        const result = await fetchLeads({ page, limit: pageSize, search, signal })
        // Ignore stale responses if the query changed while this one was in flight
        if (requestId === requestIdRef.current) {
          setLeads(result.data)
          setTotal(result.total)
        }
      } catch (err) {
        if (err.name !== 'AbortError' && requestId === requestIdRef.current) {
          setError(err.message || 'Failed to load leads')
          setLeads([])
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [page, pageSize, search]
  )

useEffect(() => {
    const controller = new AbortController()
    
    // Wrap the invocation to defer synchronous state updates 
    // to the microtask queue, preventing cascading renders.
    const fetchInitialLeads = async () => {
      await loadLeads(controller.signal)
    }
    
    fetchInitialLeads()
    
    return () => controller.abort()
  }, [loadLeads])

  // Debounce the search box: wait for typing to settle, then fetch fresh from page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const goFirst = () => setPage(1)
  const goPrev = () => setPage((p) => Math.max(p - 1, 1))
  const goNext = () => setPage((p) => Math.min(p + 1, totalPages))
  const goLast = () => setPage(totalPages)

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value))
    setPage(1)
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  const headerCells = useMemo(
    () =>
      COLUMNS.map((col) => (
        <th
          key={col.key}
          scope="col"
          className="sticky top-0 z-10 whitespace-nowrap bg-slate-800 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-200"
        >
          {col.label}
        </th>
      )),
    []
  )

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Lead Manager</h1>
            <p className="text-sm text-slate-500">
              Browse and track onboarding leads, payments and follow-ups
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-right">
            <p className="text-2xl font-bold text-slate-900">{total}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Leads</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Toolbar: search + chunk size */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, contact, email or payment ID…"
            className="w-full max-w-md rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Rows per chunk
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>⚠ {error}</span>
            <button
              type="button"
              onClick={() => loadLeads()}
              className="rounded-md border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[65vh] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>{headerCells}</thead>
              <tbody className="divide-y divide-slate-100">
                {loading && leads.length === 0 &&
                  Array.from({ length: Math.min(pageSize, 10) }, (_, i) => (
                    <tr key={`skeleton-${i}`}>
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="whitespace-nowrap px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-slate-200" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!loading &&
                  leads.map((lead) => (
                    <tr key={lead._id} className="hover:bg-indigo-50/50">
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {col.render(lead[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                {!loading && !error && leads.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-16 text-center text-slate-500">
                      {search ? `No leads match “${search}”` : 'No leads in the database yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-600">
              Showing <span className="font-semibold text-slate-900">{rangeStart}–{rangeEnd}</span> of{' '}
              <span className="font-semibold text-slate-900">{total}</span> leads
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goFirst}
                disabled={loading || page === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                « First
              </button>
              <button
                type="button"
                onClick={goPrev}
                disabled={loading || page === 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹ Prev
              </button>
              <span className="px-2 text-sm font-medium text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={loading || page >= totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next ›
              </button>
              <button
                type="button"
                onClick={goLast}
                disabled={loading || page >= totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Last »
              </button>
            </div>
          </div>

        </div>
      </main>

    </div>
  )
}

export default App