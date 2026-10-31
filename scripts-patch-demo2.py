"""Surgical patch: add suppliers/stocktakes/import/restock to demo-api.ts."""
import sys

PATH = r"C:\project\StockSpace_OpenCode_PRD_Kit\stockspace\apps\web\src\api\demo-api.ts"
TYPES = r"C:\project\StockSpace_OpenCode_PRD_Kit\stockspace\apps\web\src\types.ts"
src = open(PATH, encoding="utf-8").read()

# 1. duplicate products line out
dup = "    products: mockProducts.map((product) => ({ ...product })),\n"
if dup in src:
    src = src.replace(dup, "", 1)
    print("duplicate products line removed")

# 2. interfaces + state fields
if "interface DemoSupplier" not in src:
    src = src.replace(
        "interface DemoState {",
        """interface DemoSupplier {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
}

interface DemoStocktakeLine {
  id: string
  productId: string
  locationId: string
  level: number
  expectedQty: number
  countedQty: number | null
}

interface DemoStocktake {
  id: string
  warehouseId: string
  status: StocktakeStatus
  note: string | null
  createdById: string
  createdAt: string
  completedAt: string | null
  lines: DemoStocktakeLine[]
}

interface DemoState {
  suppliers: DemoSupplier[]
  stocktakes: DemoStocktake[]""",
        1,
    )
    print("interfaces inserted")

# 3. DEMO_SUPPLIERS seed
if "const DEMO_SUPPLIERS" not in src:
    src = src.replace(
        "function resetDemoState(options: { signedIn?: boolean } = {}) {",
        """const DEMO_SUPPLIERS: DemoSupplier[] = [
  {
    id: 'sup-1',
    name: 'PT Sumber Teknik',
    contactName: 'Andi Wijaya',
    email: 'andi@sumberteknik.example',
    phone: '021-555-0101',
    address: 'Jl. Industri Raya 12, Jakarta',
    notes: null,
  },
  {
    id: 'sup-2',
    name: 'CV Aksesori Nusantara',
    contactName: 'Rina Hartati',
    email: 'rina@aksesorinusantara.example',
    phone: '022-555-0102',
    address: null,
    notes: 'Pengiriman hanya hari kerja.',
  },
]

function resetDemoState(options: { signedIn?: boolean } = {}) {""",
        1,
    )
    print("DEMO_SUPPLIERS seeded")

# 4. supplierId in handleMovement
if "supplierId" not in src.split("// ---------- router ----------")[0].split("function handleMovement")[1] if "function handleMovement" in src else True:
    anchor = "  if (debitLocation) applyBalance(productId, debitLocation, debitLevel, -debitAmount)"
    if anchor in src:
        src = src.replace(
            anchor,
            """  let supplierId: string | null = null
  if (kind === 'stock-in' && body.supplierId) {
    const supplier = state.suppliers.find((item) => item.id === body.supplierId)
    if (!supplier) {
      return jsonResponse(
        { error: { code: 'SUPPLIER_NOT_FOUND', message: 'Supplier tidak ditemukan di workspace ini.' } },
        404
      )
    }
    supplierId = supplier.id
  }

""" + anchor,
            1,
        )
        src = src.replace(
            "    note: note || null,\n    actor: state.session.user.name,",
            "    note: note || null,\n    supplierId,\n    actor: state.session.user.name,",
            1,
        )
        print("handleMovement supplierId wired")

# 5. routes: suppliers + stocktakes + import + restock
ROUTES = """  // ---- suppliers ----
  if (route === '/api/suppliers' && method === 'GET') {
    if (!state.session) return jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Sesi tidak ditemukan.' } }, 401)
    const search = query.get('search')?.toLowerCase()
    return jsonResponse({
      data: state.suppliers
        .filter((supplier) =>
          search
            ? supplier.name.toLowerCase().includes(search) ||
              (supplier.contactName ?? '').toLowerCase().includes(search)
            : true
        )
        .map((supplier) => ({
          ...supplier,
          _count: { products: state.products.filter((product) => product.supplierId === supplier.id).length },
        })),
    })
  }
  if (route === '/api/suppliers' && method === 'POST') {
    if (!state.session || !roleAtLeast(state.session.role, 'ADMIN')) {
      return jsonResponse(
        { error: { code: 'ROLE_FORBIDDEN', message: 'Peran Anda tidak berhak melakukan aksi ini (butuh ADMIN+).' } },
        403
      )
    }
    const supplier: DemoSupplier = {
      id: `sup-${++state.counter}`,
      name: String(body.name ?? 'Supplier baru'),
      contactName: (body.contactName as string) ?? null,
      email: (body.email as string) ?? null,
      phone: (body.phone as string) ?? null,
      address: (body.address as string) ?? null,
      notes: (body.notes as string) ?? null,
    }
    state.suppliers.push(supplier)
    return jsonResponse({ data: supplier })
  }
  if (route.startsWith('/api/suppliers/') && (method === 'PATCH' || method === 'DELETE')) {
    if (!state.session || !roleAtLeast(state.session.role, 'ADMIN')) {
      return jsonResponse(
        { error: { code: 'ROLE_FORBIDDEN', message: 'Peran Anda tidak berhak melakukan aksi ini (butuh ADMIN+).' } },
        403
      )
    }
    const id = route.split('/api/suppliers/')[1]
    const index = state.suppliers.findIndex((supplier) => supplier.id === id)
    if (index === -1) {
      return jsonResponse({ error: { code: 'SUPPLIER_NOT_FOUND', message: 'Supplier tidak ditemukan.' } }, 404)
    }
    if (method === 'DELETE') {
      const inUse = state.products.filter((product) => product.supplierId === id).length
      if (inUse > 0) {
        return jsonResponse(
          { error: { code: 'SUPPLIER_IN_USE', message: `Supplier masih dipakai ${inUse} produk — lepas dulu relasinya.` } },
          409
        )
      }
      state.suppliers.splice(index, 1)
      return jsonResponse({ data: { id } })
    }
    state.suppliers[index] = { ...state.suppliers[index], ...(body as Partial<DemoSupplier>) }
    return jsonResponse({ data: state.suppliers[index] })
  }

  // ---- stocktakes ----
  if (route === '/api/stocktakes' && method === 'GET') {
    if (!state.session) return jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Sesi tidak ditemukan.' } }, 401)
    return jsonResponse({
      data: state.stocktakes.map((stocktake) => ({
        ...stocktake,
        warehouse: { ...warehouse },
        createdBy: { id: stocktake.createdById, name: state.session?.user.name ?? '—' },
        _count: { lines: stocktake.lines.length },
      })),
    })
  }
  if (route === '/api/stocktakes' && method === 'POST') {
    if (!state.session || !roleAtLeast(state.session.role, 'STAFF')) {
      return jsonResponse(
        { error: { code: 'ROLE_FORBIDDEN', message: 'Peran Anda tidak berhak melakukan aksi ini (butuh STAFF+).' } },
        403
      )
    }
    if (state.stocktakes.some((stocktake) => stocktake.status === 'OPEN')) {
      return jsonResponse(
        { error: { code: 'STOCKTAKE_OPEN', message: 'Masih ada stock opname berstatus terbuka — selesaikan atau batalkan dulu.' } },
        409
      )
    }
    const stocktake: DemoStocktake = {
      id: `st-${++state.counter}`,
      warehouseId: warehouse.id,
      status: 'OPEN',
      note: (body.note as string) ?? null,
      createdById: state.session.user.id,
      createdAt: new Date().toISOString(),
      completedAt: null,
      lines: state.balances.map((balance, index) => ({
        id: `stl-${state.counter}-${index}`,
        productId: balance.productId,
        locationId: balance.locationId,
        level: balance.level ?? 1,
        expectedQty: balance.quantity,
        countedQty: null,
      })),
    }
    state.stocktakes.unshift(stocktake)
    return jsonResponse({ data: { ...stocktake, _count: { lines: stocktake.lines.length } } })
  }
  if (route.startsWith('/api/stocktakes/')) {
    if (!state.session) return jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Sesi tidak ditemukan.' } }, 401)
    const parts = route.split('/api/stocktakes/')[1].split('/')
    const stocktake = state.stocktakes.find((item) => item.id === parts[0])
    if (!stocktake) return jsonResponse({ error: { code: 'STOCKTAKE_NOT_FOUND', message: 'Stock opname tidak ditemukan.' } }, 404)

    if (method === 'GET' && parts.length === 1) {
      return jsonResponse({
        data: {
          ...stocktake,
          warehouse: { ...warehouse },
          createdBy: { id: stocktake.createdById, name: state.session.user.name },
          lines: stocktake.lines.map((line) => ({
            ...line,
            product: state.products.find((product) => product.id === line.productId) ?? {
              id: line.productId,
              sku: '—',
              name: 'Produk tidak dikenal',
              unit: 'pcs',
            },
            location: locations.find((location) => location.id === line.locationId) ?? {
              id: line.locationId,
              code: '—',
              label: 'Lokasi tidak dikenal',
            },
          })),
        },
      })
    }
    if (parts[1] === 'lines' && method === 'PATCH' && parts.length === 3) {
      if (stocktake.status !== 'OPEN') {
        return jsonResponse({ error: { code: 'STOCKTAKE_CLOSED', message: 'Stock opname ini sudah ditutup.' } }, 409)
      }
      const line = stocktake.lines.find((item) => item.id === parts[2])
      if (!line) return jsonResponse({ error: { code: 'STOCKTAKE_LINE_NOT_FOUND', message: 'Baris hitung tidak ditemukan.' } }, 404)
      line.countedQty = body.countedQty === null ? null : Number(body.countedQty)
      return jsonResponse({ data: line })
    }
    if (parts[1] === 'commit' && method === 'POST') {
      if (stocktake.status !== 'OPEN') {
        return jsonResponse({ error: { code: 'STOCKTAKE_CLOSED', message: 'Stock opname ini sudah ditutup.' } }, 409)
      }
      let adjustments = 0
      for (const line of stocktake.lines) {
        if (line.countedQty === null || line.countedQty === line.expectedQty) continue
        const delta = line.countedQty - line.expectedQty
        applyBalance(line.productId, line.locationId, line.level, delta)
        state.movements.unshift({
          id: `mv-stk-${++state.counter}`,
          productId: line.productId,
          type: 'ADJUSTMENT',
          quantity: delta,
          sourceLocationId: delta < 0 ? line.locationId : null,
          destinationLocationId: delta > 0 ? line.locationId : null,
          reference: `ST-${stocktake.id.slice(-6).toUpperCase()}`,
          note: `Hasil stock opname: hitung ${line.countedQty}, tercatat ${line.expectedQty}`,
          actor: state.session.user.name,
          createdAt: new Date().toISOString(),
        })
        maybeAddLowStockNotification(line.productId)
        adjustments += 1
      }
      stocktake.status = 'COMPLETED'
      stocktake.completedAt = new Date().toISOString()
      return jsonResponse({
        data: {
          stocktake,
          adjustments,
          countedLines: stocktake.lines.filter((line) => line.countedQty !== null).length,
          skippedLines: stocktake.lines.filter((line) => line.countedQty === null).length,
        },
      })
    }
    if (parts[1] === 'cancel' && method === 'POST') {
      stocktake.status = 'CANCELLED'
      stocktake.completedAt = new Date().toISOString()
      return jsonResponse({ data: stocktake })
    }
  }

  // ---- product import (must run before the detail route) ----
  if (route === '/api/products/import' && method === 'POST') {
    if (!state.session || !roleAtLeast(state.session.role, 'ADMIN')) {
      return jsonResponse(
        { error: { code: 'ROLE_FORBIDDEN', message: 'Peran Anda tidak berhak melakukan aksi ini (butuh ADMIN+).' } },
        403
      )
    }
    const rows = (body.rows as Array<Record<string, unknown>>) ?? []
    const created: string[] = []
    const updated: string[] = []
    const errors: { row: number; message: string }[] = []
    rows.forEach((row, index) => {
      const sku = String(row.sku ?? '').trim()
      const name = String(row.name ?? '').trim()
      if (!sku || !name) {
        errors.push({ row: index + 1, message: 'SKU dan nama wajib diisi.' })
        return
      }
      const existing = state.products.find((product) => product.sku === sku)
      if (existing) {
        existing.name = name
        existing.unit = String(row.unit ?? existing.unit)
        existing.barcode = (row.barcode as string) ?? existing.barcode
        existing.costPrice = Number(row.costPrice ?? existing.costPrice)
        existing.reorderThreshold = Number(row.reorderThreshold ?? existing.reorderThreshold)
        updated.push(sku)
      } else {
        state.products.push({
          id: `prd-${++state.counter}`,
          sku,
          name,
          category: null,
          unit: String(row.unit ?? 'pcs'),
          barcode: (row.barcode as string) ?? null,
          costPrice: Number(row.costPrice ?? 0),
          reorderThreshold: Number(row.reorderThreshold ?? 0),
          description: (row.description as string) ?? null,
          active: true,
          totalQuantity: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        created.push(sku)
      }
    })
    return jsonResponse({ data: { created, updated, errors } })
  }

  // ---- restock report ----
  if (route === '/api/reports/restock') {
    if (!state.session) return jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Sesi tidak ditemukan.' } }, 401)
    const quantities = quantityByProduct(state.balances)
    const items = state.products
      .filter((product) => product.active && (quantities.get(product.id) ?? 0) < product.reorderThreshold)
      .map((product) => {
        const shortfall = Math.max(0, product.reorderThreshold - (quantities.get(product.id) ?? 0))
        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          quantity: quantities.get(product.id) ?? 0,
          reorderThreshold: product.reorderThreshold,
          shortfall,
          estimatedCost: shortfall * product.costPrice,
          supplier: state.suppliers.find((supplier) => supplier.id === product.supplierId) ?? null,
        }
      })
      .sort((a, b) => b.estimatedCost - a.estimatedCost)
    return jsonResponse({
      data: items,
      totalEstimatedCost: items.reduce((sum, item) => sum + item.estimatedCost, 0),
    })
  }

"""
if "'/api/suppliers'" not in src:
    anchor = "  // ---- product import (must run before the detail route) ----\n" if "// ---- product import" in src else "  const productIdFromPath = route.startsWith('/api/products/')"
    if anchor in src:
        src = src.replace(anchor, ROUTES + anchor, 1)
        print("routes inserted")
    else:
        print("ERROR: route anchor missing")
        sys.exit(1)

# 6. import route must precede detail handling — move import block above productIdFromPath
imp = "  // ---- product import (must run before the detail route) ----\n"
start = src.find(imp)
if start != -1:
    end = src.find("  // ---- suppliers ----", start)
    block = src[start:end]
    src = src[:start] + src[end:]
    anchor2 = "  const productIdFromPath = route.startsWith('/api/products/')"
    src = src.replace(anchor2, block + anchor2, 1)
    print("import block hoisted")

# 7. export.csv: restock branch
if "report === 'restock'" not in src:
    csv_anchor = """  if (route === '/api/reports/export.csv') {
    const report = query.get('report') ?? 'movements'
"""
    restock_csv = """  if (route === '/api/reports/export.csv') {
    const report = query.get('report') ?? 'movements'
    if (report === 'restock') {
      const quantities = quantityByProduct(state.balances)
      const rows: string[][] = [
        ['sku', 'produk', 'unit', 'stok', 'ambang', 'usulan_beli', 'estimasi_biaya', 'supplier'],
        ...state.products
          .filter((product) => product.active && (quantities.get(product.id) ?? 0) < product.reorderThreshold)
          .map((product) => {
            const shortfall = product.reorderThreshold - (quantities.get(product.id) ?? 0)
            const supplier = state.suppliers.find((item) => item.id === product.supplierId)
            return [
              product.sku, product.name, product.unit,
              String(quantities.get(product.id) ?? 0), String(product.reorderThreshold),
              String(shortfall), String(shortfall * product.costPrice), supplier?.name ?? '',
            ]
          }),
      ]
      const csv = rows
        .map((row) => row.map((cell) => (/[",\\n;]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
        .join('\\r\\n')
      return new Response(csv, { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8' } })
    }
"""
    if csv_anchor in src:
        src = src.replace(csv_anchor, restock_csv, 1)
        print("restock CSV added")
    else:
        print("ERROR: csv anchor missing")
        sys.exit(1)

open(PATH, "w", encoding="utf-8", newline="").write(src)

# 8. types.ts: StocktakeStatus
tsrc = open(TYPES, encoding="utf-8").read()
if "StocktakeStatus" not in tsrc:
    tsrc = tsrc.replace(
        "export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'",
        "export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'\nexport type StocktakeStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED'",
    )
    open(TYPES, "w", encoding="utf-8", newline="").write(tsrc)
    print("StocktakeStatus added to types")
print("ALL DONE")
