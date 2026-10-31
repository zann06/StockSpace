"""Patch 2: product detail supplier include, import dialog, suppliers card, csv type."""
import sys

API = r"C:\project\StockSpace_OpenCode_PRD_Kit\stockspace\apps\api\src\routes\products.ts"
DEMO = r"C:\project\StockSpace_OpenCode_PRD_Kit\stockspace\apps\web\src\api\demo-api.ts"
HOOKS = r"C:\project\StockSpace_OpenCode_PRD_Kit\stockspace\apps\web\src\api\hooks.ts"
REPORTS = r"C:\project\StockSpace_OpenCode_PRD_Kit\stockspace\apps\web\src\pages\ReportsPage.tsx"
INVENTORY = r"C:\project\StockSpace_OpenCode_PRD_Kit\stockspace\apps\web\src\pages\InventoryPage.tsx"
SETTINGS = r"C:\project\StockSpace_OpenCode_PRD_Kit\stockspace\apps\web\src\pages\SettingsPage.tsx"

# 1. API product detail: include supplier
src = open(API, encoding="utf-8").read()
if "supplier:" not in src.split("app.get('/api/products/:id'")[1].split("app.patch")[0]:
    src = src.replace(
        """      include: { category: { select: { id: true, name: true } } },
    })
    if (!product) throw AppError.notFound(ERRORS.PRODUCT_NOT_FOUND, 'Produk tidak ditemukan.')""",
        """      include: {
        category: { select: { id: true, name: true } },
        supplier: {
          select: { id: true, name: true, contactName: true, email: true, phone: true },
        },
      },
    })
    if (!product) throw AppError.notFound(ERRORS.PRODUCT_NOT_FOUND, 'Produk tidak ditemukan.')""",
        1,
    )
    open(API, "w", encoding="utf-8", newline="").write(src)
    print("1. API detail supplier include added")

# 2. demo detail: include supplier
src = open(DEMO, encoding="utf-8").read()
if "supplier:" not in src.split("if (route.startsWith('/api/products/')")[1].split("if (route === '/api/products'")[0]:
    src = src.replace(
        """      return jsonResponse({
        data: {
          ...product,
          balances: productBalances,
          movements: apiMovements().filter((movement) => movement.productId === id).slice(0, 20),
        },
      })""",
        """      return jsonResponse({
        data: {
          ...product,
          supplier: state.suppliers.find((item) => item.id === product.supplierId) ?? null,
          balances: productBalances,
          movements: apiMovements().filter((movement) => movement.productId === id).slice(0, 20),
        },
      })""",
        1,
    )
    open(DEMO, "w", encoding="utf-8", newline="").write(src)
    print("2. demo detail supplier added")

# 3. hooks useProduct type: supplier
src = open(HOOKS, encoding="utf-8").read()
if "supplier:" not in src.split("export function useProduct")[1].split("export function useCategories")[0]:
    src = src.replace(
        """      apiFetch<{
        data: ApiProduct & {
          balances: {""",
        """      apiFetch<{
        data: ApiProduct & {
          supplier: { id: string; name: string } | null
          balances: {""",
        1,
    )
    open(HOOKS, "w", encoding="utf-8", newline="").write(src)
    print("3. hooks product supplier type added")

# 4. ReportsPage: widen exportCsv local type
src = open(REPORTS, encoding="utf-8").read()
src = src.replace(
    "const exportCsv = async (report: 'low-stock' | 'movements') => {",
    "const exportCsv = async (report: 'low-stock' | 'movements' | 'restock') => {",
)
open(REPORTS, "w", encoding="utf-8", newline="").write(src)
print("4. ReportsPage exportCsv widened")

# 5. InventoryPage: import dialog + button
src = open(INVENTORY, encoding="utf-8").read()
if "ImportDialog" not in src:
    src = src.replace(
        """        actions={
          canManageProducts ? (
            <Link to="/inventory/products/new">
              <Button>
                <PackagePlus aria-hidden className="h-4 w-4" />
                {t('Tambah Produk')}
              </Button>
            </Link>
          ) : undefined
        }""",
        """        actions={
          <>
            {canManageProducts ? (
              <Link to="/inventory/products/new">
                <Button>
                  <PackagePlus aria-hidden className="h-4 w-4" />
                  {t('Tambah Produk')}
                </Button>
              </Link>
            ) : undefined}
            {canManageProducts ? (
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload aria-hidden className="h-4 w-4" />
                {t('Import CSV')}
              </Button>
            ) : undefined}
          </>
        }""",
        1,
    )
    src = src.replace(
        "import { ChevronLeft, ChevronRight, Package, PackagePlus, SearchX } from 'lucide-react'",
        "import { ChevronLeft, ChevronRight, Package, PackagePlus, SearchX, Upload } from 'lucide-react'",
        1,
    )
    # import hooks + state + dialog component: add after imports (useInventoryImport defined below)
    src = src.replace(
        "import { useCategories, useProductsList, useWarehouseData } from '@/api/hooks'",
        "import { useCategories, useProductsList, useWarehouseData } from '@/api/hooks'\nimport { useImportProducts, type ImportRow } from '@/api/features'",
        1,
    )
    src = src.replace(
        "export function InventoryPage() {",
        """export function InventoryPage() {
  const [importOpen, setImportOpen] = useState(false)""",
        1,
    )
    src = src.replace(
      "      <p className=\"flex items-center gap-1.5 text-xs text-muted\">\n        <Package aria-hidden className=\"h-3.5 w-3.5\" />\n        Klik baris produk untuk melihat detail, penyebaran lokasi, dan riwayat pergerakan.\n      </p>\n    </div>\n  )\n}",
      """      {importOpen ? <ImportDialog onClose={() => setImportOpen(false)} /> : null}

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Package aria-hidden className="h-3.5 w-3.5" />
        {t('Klik baris produk untuk melihat detail, penyebaran lokasi, dan riwayat pergerakan.')}
      </p>
    </div>
  )
}

const CSV_TIP = 'sku,name,unit,cost_price,reorder_threshold,category\\nELK-001,"Kabel USB-C",pcs,35000,20,Aksesoris'

/** Paste-or-upload CSV import dialog (ADMIN only). */
function ImportDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const importProducts = useImportProducts()
  const [csvText, setCsvText] = useState('')
  const [result, setResult] = useState<{
    created: string[]
    updated: string[]
    errors: { row: number; message: string }[]
  } | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parseCsv = (text: string): ImportRow[] => {
    const lines = text
      .split(/\\r?\\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (lines.length < 2) throw new Error(t('CSV harus berisi header dan minimal satu baris data.'))
    const delimiter = (lines[0].match(/,/g)?.length ?? 0) >= (lines[0].match(/;/g)?.length ?? 0) ? ',' : ';'
    const splitRow = (row: string): string[] => {
      const cells: string[] = []
      let current = ''
      let quoted = false
      for (const char of row) {
        if (char === '"') quoted = !quoted
        else if (char === delimiter && !quoted) {
          cells.push(current.trim())
          current = ''
        } else current += char
      }
      cells.push(current.trim())
      return cells
    }
    const header = splitRow(lines[0]).map((cell) => cell.toLowerCase().replace(/\\s+/g, '_'))
    return lines.slice(1).map((line) => {
      const cells = splitRow(line)
      const row: Record<string, string> = {}
      header.forEach((key, index) => {
        row[key] = cells[index] ?? ''
      })
      return {
        sku: row.sku ?? '',
        name: row.name ?? '',
        category: row.category || null,
        unit: row.unit || 'pcs',
        barcode: row.barcode || null,
        costPrice: row.cost_price ? Number(row.cost_price.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0 : 0,
        reorderThreshold: row.reorder_threshold ? Number.parseInt(row.reorder_threshold, 10) || 0 : 0,
        description: row.description || null,
      }
    })
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result ?? ''))
    void reader.readAsText(file)
  }

  const handleSubmit = () => {
    setParseError(null)
    try {
      const rows = parseCsv(csvText)
      importProducts.mutate(rows, { onSuccess: (data) => setResult(data.data) })
    } catch (error) {
      setParseError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('Import Produk CSV')}
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto scroll-slim rounded-card border border-line bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">{t('Import Produk CSV')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Tutup')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
          >
            ✕
          </button>
        </div>

        {result ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="rounded-control bg-success-soft px-3 py-2 text-sm font-semibold text-success-fg">
              {t('Dibuat')}: {result.created.length} · {t('Diperbarui')}: {result.updated.length} ·{' '}
              {t('Gagal')}: {result.errors.length}
            </p>
            {result.errors.map((error) => (
              <p key={error.row} className="text-xs font-semibold text-danger-fg">
                {t('Baris')} {error.row}: {error.message}
              </p>
            ))}
            <Button onClick={onClose}>{t('Selesai')}</Button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              {t('Pilih file CSV…')}
            </Button>
            <textarea
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              rows={7}
              placeholder={CSV_TIP}
              className="w-full rounded-control border border-line bg-surface px-3 py-2 font-mono text-xs text-ink"
            />
            <p className="text-[11px] leading-relaxed text-muted">
              {t(
                'Kolom: sku, name, unit, cost_price, reorder_threshold, category (opsional). Baris dengan SKU yang sudah ada akan diperbarui. Batas 1.000 baris per impor.'
              )}
            </p>
            {parseError ? (
              <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-xs font-semibold text-danger-fg">
                {parseError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={importProducts.isPending || csvText.trim() === ''}>
                {importProducts.isPending ? t('Mengimpor…') : t('Impor Sekarang')}
              </Button>
              <Button variant="secondary" onClick={onClose}>
                {t('Batal')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}"""
    assert "function ImportDialog" in src, "inventory dialog insert failed"
    open(INVENTORY, "w", encoding="utf-8", newline="").write(src)
    print("5. InventoryPage import dialog added")

# 6. SettingsPage: suppliers card
src = open(SETTINGS, encoding="utf-8").read()
if "Kelola Supplier" not in src:
    src = src.replace(
        "import { LanguageSwitch } from '@/components/ui/LanguageSwitch'",
        "import { useDeleteSupplier, useSuppliers } from '@/api/features'\nimport { LanguageSwitch } from '@/components/ui/LanguageSwitch'",
        1,
    )
    src = src.replace(
        "        <MembersCard />",
        """        <SuppliersCard />

        <MembersCard />""",
        1,
    )
    suppliers_card = """

/** Suppliers management (ADMIN actions; others read-only view). */
function SuppliersCard() {
  const { t } = useI18n()
  const suppliersQuery = useSuppliers()
  const deleteSupplier = useDeleteSupplier()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const suppliers = suppliersQuery.data?.data ?? []

  const addSupplier = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    createSupplier.mutate(
      { name: name.trim() },
      {
        onSuccess: () => setName(''),
        onError: (cause) => setError(cause instanceof Error ? cause.message : 'Gagal menambah supplier.'),
      }
    )
  }

  return (
    <Card>
      <CardHeader
        title={t('Kelola Supplier')}
        subtitle={t('Pemasok untuk produk — dipakai pada usulan restock.')}
      />
      <div className="flex flex-col gap-3 px-5 py-5">
        <ul className="flex flex-col gap-2">
          {suppliers.map((supplier) => (
            <li key={supplier.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{supplier.name}</p>
                <p className="truncate text-xs text-muted">
                  {supplier.contactName ?? '—'} · {supplier._count?.products ?? 0} {t('produk')}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => deleteSupplier.mutate(supplier.id)}
                disabled={deleteSupplier.isPending || (supplier._count?.products ?? 0) > 0}
                title={
                  (supplier._count?.products ?? 0) > 0
                    ? t('Supplier masih dipakai produk — lepas dulu relasinya.')
                    : undefined
                }
              >
                {t('Hapus')}
              </Button>
            </li>
          ))}
          {suppliers.length === 0 ? (
            <li className="text-xs text-muted">{t('Belum ada supplier.')}</li>
          ) : null}
        </ul>

        <form onSubmit={addSupplier} className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('Nama supplier baru')}
            className="h-10 flex-1 rounded-control border border-line bg-surface px-3 text-sm text-ink"
          />
          <Button type="submit" disabled={createSupplier.isPending || name.trim() === ''}>
            {t('Tambah')}
          </Button>
        </form>
        {error ? <p className="text-xs font-semibold text-danger-fg">{error}</p> : null}
      </div>
    </Card>
  )
}"""
    src = src.rstrip() + "\n" + suppliers_card
    open(SETTINGS, "w", encoding="utf-8", newline="").write(src)
    print("6. SettingsPage suppliers card added")

print("ALL DONE")
