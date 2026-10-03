/**
 * NexttGen ERP — MOCK SEED DATA (frontend-only demo)
 * ----------------------------------------------------
 * Generates a realistic, internally consistent dataset for an Aligarh-based
 * lock & hardware manufacturer/trader. All dates are relative to "today" so the
 * demo never looks stale. A seeded random generator keeps the data stable.
 *
 * Nothing here talks to a server. The result is stored in localStorage.
 */
import { calcTotals, isInterState, round2 } from '../utils/calc.js'
import { addDays, daysBetween, today } from '../utils/format.js'
import { formatDocNumber } from '../store/numbering.js'
import { rebuildAllMoves, syncStatuses } from '../store/stockEngine.js'
import { SALES_PERSONS, TRANSPORTERS, PERMISSION_MODULES, PERMISSION_TYPES, stateCode } from './constants.js'
import { qcChecklist, qcPlanKey, sampleSize, variantName, variantRates } from '../store/mfg.js'
import { buildPayroll, eachDate, isWeeklyOff, leaveDaysCount, shiftMonth } from '../store/hr.js'

export const DATA_VERSION = 5

function mulberry32(seed) {
  let a = seed
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ */
/* Masters                                                             */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  ['Door Locks', 'Mortise, cylinder, main-door and smart locks'],
  ['Padlocks', 'Brass and laminated steel padlocks'],
  ['Handles', 'Pull handles, mortise handle sets, glass door handles and knobs'],
  ['Hinges', 'Butt hinges, piano hinges and auto-close hinges'],
  ['Tower Bolts', 'Tower bolts and aldrops'],
  ['Accessories', 'Door stoppers, closers, viewers and furniture locks'],
  ['Raw Materials', 'Metals, castings and lock components used in production'],
  ['Packaging', 'Cartons, blister packs and master cartons'],
]

const BRANDS = [
  ['NexttGen', 'In-house brand for premium locks and hardware'],
  ['Royal Guard', 'High-security padlocks and main door locks'],
  ['SecureMax', 'Cylinder locks, closers and smart locks (traded)'],
  ['Aligarh Classic', 'Traditional brass hardware range'],
  ['SteelCraft', 'Stainless steel handles, hinges and bolts'],
  ['Generic', 'Unbranded raw materials and consumables'],
]

const UNITS = [
  ['PCS', 'Pieces', 0],
  ['BOX', 'Box', 0],
  ['KG', 'Kilogram', 3],
  ['METER', 'Meter', 2],
  ['SET', 'Set', 0],
  ['PAIR', 'Pair', 0],
]

const WAREHOUSES = [
  ['wh-rms', 'Raw Material Store', 'WH-RMS', 'Unit 2, Talanagri Industrial Area, Ramghat Road, Aligarh, Uttar Pradesh 202001', 'Ramesh Pal', '+91 98370 41256', 'Active'],
  ['wh-fgg', 'Finished Goods Godown', 'WH-FGG', 'Plot No. 42, Talanagri Industrial Estate, Aligarh, Uttar Pradesh 202001', 'Suresh Yadav', '+91 97194 22318', 'Active'],
  ['wh-del', 'Delhi Depot', 'WH-DEL', 'B-118, Naraina Industrial Area Phase II, New Delhi 110028', 'Sanjay Arora', '+91 98111 56420', 'Active'],
  ['wh-scr', 'Rejection & Scrap Yard', 'WH-SCR', 'Unit 2 Rear Yard, Talanagri Industrial Area, Aligarh 202001', 'Ramesh Pal', '+91 98370 41256', 'Active'],
  ['wh-jbw', 'At Job Workers', 'WH-JBW', 'Virtual location – material lying with plating, buffing and heat-treatment job workers', 'Ramesh Pal', '+91 98370 41256', 'Active'],
  ['wh-bhw', 'Bhiwandi Transit Godown', 'WH-BHW', 'Gala No. 7, Rahnal Village, Bhiwandi, Maharashtra 421302', 'Imran Shaikh', '+91 90040 71833', 'Inactive'],
]

// [id, code, name, category, subCategory, brand, unit, hsn, gst, purchaseRate, salesRate, minStock, type, warehouseId, targetBalance]
const ITEMS = [
  ['fg-1001', 'FG-1001', 'Premium Door Lock', 'Door Locks', 'Mortise Locks', 'NexttGen', 'PCS', '83014090', 18, 420, 845, 150, 'Finished Good', 'wh-fgg', 640],
  ['fg-1002', 'FG-1002', 'Mortise Lock 250mm Stainless Steel', 'Door Locks', 'Mortise Locks', 'NexttGen', 'PCS', '83014090', 18, 610, 1150, 100, 'Finished Good', 'wh-fgg', 310],
  ['fg-1003', 'FG-1003', 'Brass Padlock 50mm Polished Brass', 'Padlocks', 'Brass Padlocks', 'Aligarh Classic', 'PCS', '83011000', 18, 185, 340, 200, 'Finished Good', 'wh-fgg', 820],
  ['fg-1004', 'FG-1004', 'Laminated Steel Padlock 65mm', 'Padlocks', 'Steel Padlocks', 'Royal Guard', 'PCS', '83011000', 18, 210, 395, 150, 'Finished Good', 'wh-fgg', 95],
  ['fg-1005', 'FG-1005', 'Cylinder Lock 70mm Satin Nickel', 'Door Locks', 'Cylinder Locks', 'SecureMax', 'PCS', '83014090', 18, 340, 640, 120, 'Finished Good', 'wh-fgg', 410],
  ['fg-1006', 'FG-1006', 'Cabinet Lock 20mm', 'Accessories', 'Furniture Locks', 'NexttGen', 'PCS', '83014090', 18, 48, 95, 300, 'Finished Good', 'wh-fgg', 140],
  ['fg-1007', 'FG-1007', 'Pull Handle 8" Stainless Steel', 'Handles', 'Pull Handles', 'SteelCraft', 'PCS', '83024110', 18, 96, 185, 250, 'Finished Good', 'wh-fgg', 1260],
  ['fg-1008', 'FG-1008', 'Door Handle Set with Mortise Plate', 'Handles', 'Mortise Handles', 'NexttGen', 'SET', '83024110', 18, 520, 980, 80, 'Finished Good', 'wh-fgg', 215],
  ['fg-1009', 'FG-1009', 'Aldrop 10" Antique Brass', 'Tower Bolts', 'Aldrops', 'Aligarh Classic', 'PCS', '83024190', 18, 145, 275, 150, 'Finished Good', 'wh-fgg', 480],
  ['fg-1010', 'FG-1010', 'Tower Bolt 6" Stainless Steel', 'Tower Bolts', 'Tower Bolts', 'SteelCraft', 'PCS', '83024190', 18, 58, 112, 400, 'Finished Good', 'wh-fgg', 1840],
  ['fg-1011', 'FG-1011', 'Door Hinge 4" Stainless Steel', 'Hinges', 'Butt Hinges', 'SteelCraft', 'PAIR', '83021090', 18, 62, 118, 500, 'Finished Good', 'wh-fgg', 2150],
  ['fg-1012', 'FG-1012', 'Glass Door Handle 12" Matt Finish', 'Handles', 'Glass Door Handles', 'SecureMax', 'PCS', '83024110', 18, 390, 745, 60, 'Finished Good', 'wh-fgg', 0],
  ['fg-1013', 'FG-1013', 'Main Door Lock Brass Antique', 'Door Locks', 'Main Door Locks', 'Royal Guard', 'PCS', '83014090', 18, 1250, 2390, 40, 'Finished Good', 'wh-fgg', 118],
  ['fg-1014', 'FG-1014', 'Multi-purpose Drawer Lock', 'Accessories', 'Furniture Locks', 'NexttGen', 'PCS', '83014090', 18, 72, 138, 250, 'Finished Good', 'wh-fgg', 205],
  ['tr-2001', 'TR-2001', 'Magnetic Door Stopper Stainless Steel', 'Accessories', 'Door Stoppers', 'SteelCraft', 'PCS', '83024190', 18, 82, 149, 150, 'Trading Goods', 'wh-fgg', 560],
  ['tr-2002', 'TR-2002', 'Hydraulic Door Closer 60kg', 'Accessories', 'Door Closers', 'SecureMax', 'PCS', '83026000', 18, 640, 1090, 40, 'Trading Goods', 'wh-fgg', 74],
  ['tr-2003', 'TR-2003', 'Door Viewer 200° Brass', 'Accessories', 'Door Viewers', 'Aligarh Classic', 'PCS', '90138010', 18, 68, 129, 100, 'Trading Goods', 'wh-fgg', 38],
  ['tr-2004', 'TR-2004', 'Digital Smart Door Lock (Fingerprint)', 'Door Locks', 'Smart Locks', 'SecureMax', 'PCS', '85437099', 18, 5400, 8990, 15, 'Trading Goods', 'wh-fgg', 22],
  ['tr-2005', 'TR-2005', 'Cabinet Knob Set (10 pcs)', 'Handles', 'Knobs', 'NexttGen', 'BOX', '83024200', 18, 165, 299, 80, 'Trading Goods', 'wh-fgg', 196],
  ['rm-3001', 'RM-3001', 'Lock Body – Zinc Die-cast', 'Raw Materials', 'Lock Components', 'Generic', 'PCS', '83019000', 18, 145, 0, 500, 'Raw Material', 'wh-rms', 1450],
  ['rm-3002', 'RM-3002', 'Hardened Steel Shackle 50mm', 'Raw Materials', 'Lock Components', 'Generic', 'PCS', '83019000', 18, 72, 0, 500, 'Raw Material', 'wh-rms', 1320],
  ['rm-3003', 'RM-3003', 'Compression Spring 8mm', 'Raw Materials', 'Springs', 'Generic', 'PCS', '73202000', 18, 3.5, 0, 3000, 'Raw Material', 'wh-rms', 2600],
  ['rm-3004', 'RM-3004', 'SS Screw M4 x 20mm', 'Raw Materials', 'Fasteners', 'Generic', 'PCS', '73181500', 18, 0.9, 0, 8000, 'Raw Material', 'wh-rms', 21400],
  ['rm-3005', 'RM-3005', 'Brass Cylinder Core 60mm', 'Raw Materials', 'Lock Components', 'Generic', 'PCS', '83019000', 18, 118, 0, 400, 'Raw Material', 'wh-rms', 910],
  ['rm-3006', 'RM-3006', 'Brass Key Blank', 'Raw Materials', 'Lock Components', 'Generic', 'PCS', '83019000', 18, 9, 0, 3000, 'Raw Material', 'wh-rms', 5400],
  ['rm-3007', 'RM-3007', 'Brass Rod 12mm', 'Raw Materials', 'Metals', 'Generic', 'KG', '74072110', 18, 590, 0, 250, 'Raw Material', 'wh-rms', 610],
  ['rm-3008', 'RM-3008', 'MS Sheet 1.2mm', 'Raw Materials', 'Metals', 'Generic', 'KG', '72091730', 18, 68, 0, 800, 'Raw Material', 'wh-rms', 2350],
  ['rm-3009', 'RM-3009', 'SS Sheet 304 Grade 1mm', 'Raw Materials', 'Metals', 'Generic', 'KG', '72193500', 18, 245, 0, 400, 'Raw Material', 'wh-rms', 380],
  ['rm-3010', 'RM-3010', 'Zinc Alloy Ingot (Zamak-3)', 'Raw Materials', 'Metals', 'Generic', 'KG', '79011200', 18, 285, 0, 500, 'Raw Material', 'wh-rms', 1180],
  ['rm-3011', 'RM-3011', 'Latch Bolt Assembly', 'Raw Materials', 'Lock Components', 'Generic', 'PCS', '83019000', 18, 36, 0, 500, 'Raw Material', 'wh-rms', 1240],
  ['rm-3012', 'RM-3012', 'Handle Grip Casting', 'Raw Materials', 'Handle Components', 'Generic', 'PCS', '83029000', 18, 64, 0, 400, 'Raw Material', 'wh-rms', 860],
  ['rm-3013', 'RM-3013', 'Nickel Plating Solution', 'Raw Materials', 'Consumables', 'Generic', 'KG', '38249900', 18, 820, 0, 40, 'Consumable', 'wh-rms', 55],
  ['pk-4001', 'PK-4001', 'Printed Carton Box – Small', 'Packaging', 'Cartons', 'NexttGen', 'PCS', '48191010', 12, 11, 0, 2000, 'Packaging Material', 'wh-rms', 6200],
  ['pk-4002', 'PK-4002', 'Blister Pack with Printed Card', 'Packaging', 'Blister Packs', 'NexttGen', 'PCS', '39235090', 18, 6, 0, 3000, 'Packaging Material', 'wh-rms', 4100],
  ['pk-4003', 'PK-4003', 'Master Carton 5-Ply', 'Packaging', 'Cartons', 'NexttGen', 'PCS', '48191010', 12, 38, 0, 300, 'Packaging Material', 'wh-rms', 720],
  ['sf-5001', 'SF-5001', 'Lock Body – Buffed, for Plating', 'Raw Materials', 'Semi Finished', 'Generic', 'PCS', '83019000', 18, 160, 0, 200, 'Semi Finished', 'wh-rms', 420],
  ['sf-5002', 'SF-5002', 'Handle Casting – Buffed, for Antique Finish', 'Raw Materials', 'Semi Finished', 'Generic', 'PCS', '83029000', 18, 72, 0, 150, 'Semi Finished', 'wh-rms', 180],
]

/* Product families — one design in many finishes and sizes. Each variant is a real item. */
const FAMILIES = [
  {
    id: 'fam-1', code: 'FAM-PH', name: 'Pull Handle', category: 'Handles', subCategory: 'Pull Handles', brand: 'SteelCraft', unit: 'PCS', hsn: '83024110', gst: 18,
    baseSalesRate: 185, basePurchaseRate: 96, description: 'D-type pull handle, 19 mm tube. Base rate: 8" stainless steel.',
    attributes: [
      { name: 'Size', values: ['6"', '8"', '10"', '12"'], adjust: { '6"': -20, '10"': 25, '12"': 50 } },
      { name: 'Finish', values: ['Stainless Steel', 'Antique Brass', 'Satin Nickel', 'Black Matt'], adjust: { 'Antique Brass': 15, 'Satin Nickel': 10, 'Black Matt': 20 } },
    ],
  },
  {
    id: 'fam-2', code: 'FAM-BP', name: 'Brass Padlock', category: 'Padlocks', subCategory: 'Brass Padlocks', brand: 'Aligarh Classic', unit: 'PCS', hsn: '83011000', gst: 18,
    baseSalesRate: 340, basePurchaseRate: 185, description: 'Solid brass body, hardened shackle, 3 keys. Base rate: 50 mm polished brass.',
    attributes: [
      { name: 'Size', values: ['40mm', '50mm', '65mm'], adjust: { '40mm': -20, '65mm': 35 } },
      { name: 'Finish', values: ['Polished Brass', 'Antique'], adjust: { Antique: 10 } },
    ],
  },
  {
    id: 'fam-3', code: 'FAM-CL', name: 'Cylinder Lock', category: 'Door Locks', subCategory: 'Cylinder Locks', brand: 'SecureMax', unit: 'PCS', hsn: '83014090', gst: 18,
    baseSalesRate: 640, basePurchaseRate: 340, description: 'Euro-profile cylinder, 5 keys. Base rate: 70 mm satin nickel.',
    attributes: [
      { name: 'Size', values: ['60mm', '70mm', '90mm'], adjust: { '60mm': -12, '90mm': 22 } },
      { name: 'Finish', values: ['Satin Nickel', 'Antique Brass', 'Chrome'], adjust: { 'Antique Brass': 8, Chrome: 5 } },
    ],
  },
]
// Existing items that belong to a family
const FAMILY_OF = {
  'fg-1007': ['fam-1', { Size: '8"', Finish: 'Stainless Steel' }],
  'fg-1003': ['fam-2', { Size: '50mm', Finish: 'Polished Brass' }],
  'fg-1005': ['fam-3', { Size: '70mm', Finish: 'Satin Nickel' }],
}
// New variant items: [id, familyId, attributes, minStock, targetBalance]
const VARIANTS = [
  ['fg-1016', 'fam-1', { Size: '6"', Finish: 'Stainless Steel' }, 200, 640],
  ['fg-1017', 'fam-1', { Size: '10"', Finish: 'Stainless Steel' }, 150, 420],
  ['fg-1018', 'fam-1', { Size: '8"', Finish: 'Antique Brass' }, 120, 380],
  ['fg-1019', 'fam-1', { Size: '10"', Finish: 'Antique Brass' }, 80, 160],
  ['fg-1020', 'fam-1', { Size: '8"', Finish: 'Satin Nickel' }, 100, 290],
  ['fg-1021', 'fam-1', { Size: '8"', Finish: 'Black Matt' }, 60, 0],
  ['fg-1022', 'fam-2', { Size: '40mm', Finish: 'Polished Brass' }, 200, 540],
  ['fg-1023', 'fam-2', { Size: '65mm', Finish: 'Polished Brass' }, 100, 210],
  ['fg-1024', 'fam-2', { Size: '50mm', Finish: 'Antique' }, 80, 150],
  ['fg-1025', 'fam-3', { Size: '60mm', Finish: 'Satin Nickel' }, 100, 260],
  ['fg-1026', 'fam-3', { Size: '90mm', Finish: 'Satin Nickel' }, 60, 120],
  ['fg-1027', 'fam-3', { Size: '70mm', Finish: 'Antique Brass' }, 50, 95],
]
VARIANTS.forEach(([id, famId, attrs, minStock, target]) => {
  const f = FAMILIES.find((x) => x.id === famId)
  const { salesRate, purchaseRate } = variantRates(f, attrs)
  FAMILY_OF[id] = [famId, attrs]
  ITEMS.push([id, id.toUpperCase(), variantName(f, attrs), f.category, f.subCategory, f.brand, f.unit, f.hsn, f.gst, purchaseRate, salesRate, minStock, 'Finished Good', 'wh-fgg', target])
})

/* Process routes: [stage, workCentre, mode, jobWorkProcess, outputPerHour, ratePerPc] */
const ROUTES = {
  'fg-1001': [['Die Casting', 'Die-casting M/C 2 (120T)', 'In-house', '', 180, 4.5], ['Machining', 'Drilling & Tapping Line', 'In-house', '', 120, 3], ['Buffing & Polishing', 'Buffing Line A', 'In-house', '', 90, 3.5], ['Plating', '', 'Job Work', 'Nickel Plating', 0, 6], ['Assembly', 'Lock Assembly Line', 'In-house', '', 60, 9], ['Final QC', 'QC Bench', 'In-house', '', 150, 1.5], ['Packing', 'Packing Section', 'In-house', '', 240, 1]],
  'fg-1003': [['Machining', 'CNC Lathe Bay', 'In-house', '', 80, 4], ['Buffing & Polishing', 'Buffing Line B', 'In-house', '', 110, 2.5], ['Assembly', 'Lock Assembly Line', 'In-house', '', 90, 5], ['Final QC', 'QC Bench', 'In-house', '', 180, 1], ['Packing', 'Packing Section', 'In-house', '', 300, 0.8]],
  'fg-1005': [['Machining', 'CNC Lathe Bay', 'In-house', '', 70, 4.5], ['Plating', 'Plating Shop (in-house)', 'In-house', '', 200, 2.5], ['Assembly', 'Lock Assembly Line', 'In-house', '', 80, 6], ['Final QC', 'QC Bench', 'In-house', '', 160, 1.2], ['Packing', 'Packing Section', 'In-house', '', 300, 0.8]],
  'fg-1007': [['Machining', 'Power Press 40T', 'In-house', '', 300, 1.5], ['Buffing & Polishing', 'Buffing Line B', 'In-house', '', 140, 2.5], ['Assembly', 'Handle Assembly Table', 'In-house', '', 200, 1.5], ['Final QC', 'QC Bench', 'In-house', '', 300, 0.5], ['Packing', 'Packing Section', 'In-house', '', 400, 0.5]],
  'fg-1008': [['Die Casting', 'Die-casting M/C 1 (80T)', 'In-house', '', 150, 5], ['Buffing & Polishing', 'Buffing Line A', 'In-house', '', 80, 4], ['Plating', '', 'Job Work', 'Antique Finish', 0, 9], ['Assembly', 'Handle Assembly Table', 'In-house', '', 50, 12], ['Final QC', 'QC Bench', 'In-house', '', 120, 2], ['Packing', 'Packing Section', 'In-house', '', 200, 1.5]],
  'fg-1010': [['Machining', 'Power Press 40T', 'In-house', '', 400, 1], ['Buffing & Polishing', 'Buffing Line B', 'In-house', '', 250, 1.5], ['Final QC', 'QC Bench', 'In-house', '', 500, 0.3], ['Packing', 'Packing Section', 'In-house', '', 600, 0.4]],
}
const OPERATORS = ['Rafiq Ahmed', 'Sunil Kumar', 'Mukesh Yadav', 'Salim Ansari', 'Ravi Shankar', 'Imran Qureshi']

// Job workers — added after the purchase history so they never get raw-material POs.
// [name, legalName, contactPerson, address, city, state, paymentTerms, processes]
const JOB_WORKERS = [
  ['Aligarh Electroplaters', 'Aligarh Electroplaters & Finishers', 'Shahid Ali', 'Jamalpur Industrial Area, GT Road', 'Aligarh', 'Uttar Pradesh', '30 Days', ['Nickel Plating', 'Chrome Plating', 'Antique Finish']],
  ['Krishna Buffing Works', 'Krishna Buffing Works', 'Kishan Lal', 'Kishanpur Road, Near Sasni Gate', 'Aligarh', 'Uttar Pradesh', '15 Days', ['Buffing & Polishing']],
  ['Precision Heat Treaters', 'Precision Heat Treaters Pvt. Ltd.', 'Vinod Saxena', 'Site IV, Sahibabad Industrial Area', 'Ghaziabad', 'Uttar Pradesh', '30 Days', ['Heat Treatment']],
  ['Royal Powder Coaters', 'Royal Powder Coaters', 'Aftab Hussain', 'Talanagri Road, Ramghat', 'Aligarh', 'Uttar Pradesh', '15 Days', ['Powder Coating']],
]


// [name, legalName, contactPerson, address, city, state, paymentTerms, creditLimit, openingBalance, status, weight]
const CUSTOMERS = [
  ['Sharma Hardware', 'Sharma Hardware Stores', 'Ramesh Sharma', 'Shop No. 14, Chawri Bazar', 'Delhi', 'Delhi', '30 Days', 800000, 0, 'Active', 9],
  ['National Hardware Traders', 'National Hardware Traders Pvt. Ltd.', 'Imran Shaikh', '22, Lohar Chawl, Kalbadevi', 'Mumbai', 'Maharashtra', '45 Days', 1200000, 45000, 'Active', 8],
  ['Agarwal Sanitary & Hardware', 'Agarwal Sanitary & Hardware', 'Sunil Agarwal', 'Aminabad Road, Near Mohan Market', 'Lucknow', 'Uttar Pradesh', '30 Days', 600000, 0, 'Active', 7],
  ['Gupta Builders Supply', 'Gupta Builders Supply Co.', 'Manoj Gupta', '118, MI Road', 'Jaipur', 'Rajasthan', '30 Days', 500000, 0, 'Active', 5],
  ['Mehta Door Solutions', 'Mehta Door Solutions LLP', 'Hitesh Mehta', '4th Floor, Relief Road Complex', 'Ahmedabad', 'Gujarat', '45 Days', 700000, 28500, 'Active', 6],
  ['Kapoor Home Décor', 'Kapoor Home Decor', 'Vivek Kapoor', 'SCO 118, Sector 17-C', 'Chandigarh', 'Chandigarh', '30 Days', 400000, 0, 'Active', 4],
  ['Balaji Hardware Mart', 'Sri Balaji Hardware Mart', 'Venkat Reddy', '3-4-512, Ranigunj', 'Secunderabad', 'Telangana', '60 Days', 600000, 0, 'Active', 5],
  ['Shree Ganesh Traders', 'Shree Ganesh Traders', 'Prakash Joshi', '412, Budhwar Peth', 'Pune', 'Maharashtra', '30 Days', 350000, 0, 'Active', 4],
  ['Verma Hardware Stores', 'Verma Hardware Stores', 'Alok Verma', 'Naveen Market, Mall Road', 'Kanpur', 'Uttar Pradesh', '15 Days', 300000, 12000, 'Active', 5],
  ['Royal Interiors', 'Royal Interiors & Fittings Pvt. Ltd.', 'Farhan Ahmed', '27, SP Road', 'Bengaluru', 'Karnataka', '45 Days', 900000, 0, 'Active', 6],
  ['Krishna Enterprises', 'Krishna Enterprises', 'Rakesh Jain', '56, Siyaganj Main Road', 'Indore', 'Madhya Pradesh', '30 Days', 400000, 0, 'Active', 4],
  ['Jain Glass & Hardware', 'Jain Glass & Hardware', 'Paras Jain', 'Ring Road, Near Sahara Darwaja', 'Surat', 'Gujarat', '30 Days', 300000, 0, 'Active', 3],
  ['Chawla Builders Hardware', 'Chawla Builders Hardware', 'Gurpreet Chawla', 'Gill Road, Near Arora Palace', 'Ludhiana', 'Punjab', '30 Days', 450000, 0, 'Active', 4],
  ['Bansal Door & Lock Centre', 'Bansal Door & Lock Centre', 'Naresh Bansal', 'Raja Ki Mandi Crossing', 'Agra', 'Uttar Pradesh', '15 Days', 250000, 0, 'Active', 4],
  ['Dev Construction Materials', 'Dev Construction Materials', 'Anil Negi', 'Haridwar Road, Near ISBT', 'Dehradun', 'Uttarakhand', '30 Days', 300000, 0, 'Active', 3],
  ['Rathore Hardware House', 'Rathore Hardware House', 'Mahendra Rathore', 'Sojati Gate Market', 'Jodhpur', 'Rajasthan', '30 Days', 200000, 0, 'Inactive', 0],
  ['Siddhi Vinayak Hardware', 'Siddhi Vinayak Hardware', 'Sachin Deshmukh', 'Itwari Main Road', 'Nagpur', 'Maharashtra', '45 Days', 350000, 0, 'Active', 3],
  ['Patel Hardware Centre', 'Patel Hardware Centre', 'Jignesh Patel', 'Mandvi Road, Near Nyay Mandir', 'Vadodara', 'Gujarat', 'Cash', 100000, 0, 'Active', 2],
]

// [name, legalName, contactPerson, address, city, state, paymentTerms, openingBalance, itemIds]
const SUPPLIERS = [
  ['Singh Lock Industries', 'Singh Lock Industries', 'Harpreet Singh', 'Sasni Gate Industrial Area', 'Aligarh', 'Uttar Pradesh', '30 Days', 0, ['rm-3001', 'rm-3002', 'rm-3011', 'rm-3012']],
  ['Aligarh Hardware Works', 'Aligarh Hardware Works', 'Arvind Varshney', 'Mahavir Ganj', 'Aligarh', 'Uttar Pradesh', '30 Days', 18500, ['tr-2001', 'tr-2003', 'tr-2005']],
  ['Royal Lock Manufacturing', 'Royal Lock Manufacturing Co.', 'Salim Qureshi', 'Quarsi Road, Near Sutton Chauraha', 'Aligarh', 'Uttar Pradesh', '45 Days', 0, ['rm-3005', 'rm-3006']],
  ['Jindal Stainless Distributors', 'Jindal Stainless Distributors', 'Rajiv Bhatia', 'C-44, Wazirpur Industrial Area', 'Delhi', 'Delhi', '15 Days', 0, ['rm-3009', 'rm-3008']],
  ['Hindustan Zinc Traders', 'Hindustan Zinc Traders', 'Dinesh Mehta', 'Madri Industrial Area', 'Udaipur', 'Rajasthan', '30 Days', 0, ['rm-3010']],
  ['Precision Springs Pvt. Ltd.', 'Precision Springs Pvt. Ltd.', 'Vinod Malik', 'Plot 219, Sector 24', 'Faridabad', 'Haryana', '30 Days', 0, ['rm-3003']],
  ['Bharat Fasteners', 'Bharat Fasteners', 'Kuldeep Arora', 'Focal Point Phase V', 'Ludhiana', 'Punjab', '30 Days', 0, ['rm-3004']],
  ['Rajdhani Packaging Co.', 'Rajdhani Packaging Co.', 'Nitin Goel', 'B-72, Sector 63', 'Noida', 'Uttar Pradesh', '30 Days', 0, ['pk-4001', 'pk-4002', 'pk-4003']],
  ['Shakti Brass Components', 'Shakti Brass Components', 'Bhavesh Kanani', 'GIDC Shankar Tekri', 'Jamnagar', 'Gujarat', '45 Days', 0, ['rm-3007', 'rm-3005']],
  ['Surya Electroplating Chemicals', 'Surya Electroplating Chemicals', 'Pankaj Tiwari', 'Dada Nagar Industrial Area', 'Kanpur', 'Uttar Pradesh', '30 Days', 0, ['rm-3013']],
  ['SecureMax Smart Systems', 'SecureMax Smart Systems Pvt. Ltd.', 'Arjun Rao', '2nd Phase, Peenya Industrial Area', 'Bengaluru', 'Karnataka', '30 Days', 0, ['tr-2004', 'tr-2002']],
]

const PINCODES = {
  Delhi: '110006', Mumbai: '400002', Lucknow: '226018', Jaipur: '302001', Ahmedabad: '380001', Chandigarh: '160017',
  Secunderabad: '500003', Pune: '411002', Kanpur: '208001', Bengaluru: '560002', Indore: '452007', Surat: '395002',
  Ludhiana: '141003', Agra: '282002', Dehradun: '248001', Jodhpur: '342001', Nagpur: '440002', Vadodara: '390001',
  Aligarh: '202001', Udaipur: '313003', Ghaziabad: '201010', Faridabad: '121005', Noida: '201301', Jamnagar: '361004',
}

// BOM definitions: [id, code, productId, version, status, components [itemId, qty]]
const BOMS = [
  ['bom-1001', 'BOM-FG1001-V2', 'fg-1001', '2.0', 'Active', [['rm-3001', 1], ['rm-3002', 1], ['rm-3003', 2], ['rm-3004', 4], ['rm-3005', 1], ['rm-3006', 3], ['rm-3011', 1], ['pk-4001', 1]]],
  ['bom-1003', 'BOM-FG1003-V1', 'fg-1003', '1.2', 'Active', [['rm-3007', 0.18], ['rm-3002', 1], ['rm-3003', 1], ['rm-3006', 3], ['pk-4002', 1]]],
  ['bom-1005', 'BOM-FG1005-V1', 'fg-1005', '1.0', 'Active', [['rm-3005', 1], ['rm-3006', 3], ['rm-3003', 2], ['rm-3004', 2], ['pk-4001', 1]]],
  ['bom-1007', 'BOM-FG1007-V1', 'fg-1007', '1.1', 'Active', [['rm-3009', 0.14], ['rm-3012', 1], ['rm-3004', 2], ['pk-4002', 1]]],
  ['bom-1008', 'BOM-FG1008-V1', 'fg-1008', '1.0', 'Active', [['rm-3012', 2], ['rm-3011', 1], ['rm-3008', 0.35], ['rm-3004', 6], ['rm-3013', 0.01], ['pk-4001', 1]]],
  ['bom-1010', 'BOM-FG1010-V1', 'fg-1010', '1.0', 'Active', [['rm-3009', 0.09], ['rm-3004', 3], ['pk-4002', 1]]],
  ['bom-1004', 'BOM-FG1004-V1', 'fg-1004', '1.0', 'Draft', [['rm-3008', 0.22], ['rm-3002', 1], ['rm-3003', 1], ['rm-3006', 3], ['rm-3004', 2], ['pk-4002', 1]]],
]
const LABOUR_RATE = { 'fg-1001': 34, 'fg-1003': 18, 'fg-1005': 22, 'fg-1007': 9, 'fg-1008': 42, 'fg-1010': 6, 'fg-1004': 16 }
const TYPICAL_BATCH = { 'fg-1001': [300, 500, 800], 'fg-1003': [600, 1000], 'fg-1005': [300, 400, 500], 'fg-1007': [1000, 1500], 'fg-1008': [150, 250], 'fg-1010': [2000, 2500, 3000] }

const USERS = [
  ['usr-01', 'Vikram Malhotra', 'admin@nexttgen.com', '+91 98971 20045', 'Super Admin', 'Management', 'Active'],
  ['usr-02', 'Anjali Sharma', 'anjali.sharma@nexttgen.com', '+91 98370 55812', 'Admin', 'Management', 'Active'],
  ['usr-03', 'Rajesh Kumar', 'manager@nexttgen.com', '+91 97600 18423', 'Manager', 'Operations', 'Active'],
  ['usr-04', 'Pooja Agarwal', 'accounts@nexttgen.com', '+91 94120 67731', 'Accountant', 'Accounts', 'Active'],
  ['usr-05', 'Amit Verma', 'purchase@nexttgen.com', '+91 99171 30562', 'Purchase User', 'Purchase', 'Active'],
  ['usr-06', 'Neha Gupta', 'sales@nexttgen.com', '+91 98118 44207', 'Sales User', 'Sales', 'Active'],
  ['usr-07', 'Suresh Yadav', 'store@nexttgen.com', '+91 97194 22318', 'Store User', 'Stores', 'Active'],
  ['usr-08', 'Mohd. Irfan', 'production@nexttgen.com', '+91 95570 81146', 'Production User', 'Production', 'Active'],
  ['usr-09', 'Karan Singh', 'karan.singh@nexttgen.com', '+91 98731 60094', 'Sales User', 'Sales', 'Active'],
  ['usr-10', 'Arjun Mehra', 'arjun.mehra@nexttgen.com', '+91 99580 27716', 'Sales User', 'Sales', 'Active'],
  ['usr-11', 'Deepak Chauhan', 'deepak.chauhan@nexttgen.com', '+91 96340 55128', 'Employee', 'Quality', 'Active'],
  ['usr-12', 'Sunita Devi', 'sunita.devi@nexttgen.com', '+91 93590 11874', 'Store User', 'Stores', 'Inactive'],
]

/* HR — employees on the payroll. Monthly staff: [gross]; daily wage staff: [rate per day].
   [id, name, gender, department, designation, employmentType, joinedDaysAgo, shift, weeklyOff, salaryType, amount, userId, pf, esi, paymentMode, fatherName] */
const EMPLOYEES = [
  ['emp-01', 'Rajesh Kumar', 'Male', 'Operations', 'Plant Manager', 'Permanent', 2140, 'General', 'Sunday', 'Monthly', 62000, 'usr-03', true, false, 'Bank', 'Om Prakash'],
  ['emp-02', 'Pooja Agarwal', 'Female', 'Accounts', 'Accounts Executive', 'Permanent', 1510, 'General', 'Sunday', 'Monthly', 34000, 'usr-04', true, false, 'Bank', 'Sunil Agarwal'],
  ['emp-03', 'Amit Verma', 'Male', 'Purchase', 'Purchase Executive', 'Permanent', 1320, 'General', 'Sunday', 'Monthly', 30000, 'usr-05', true, false, 'Bank', 'Ramesh Verma'],
  ['emp-04', 'Neha Gupta', 'Female', 'Sales', 'Sales Executive', 'Permanent', 1105, 'General', 'Sunday', 'Monthly', 32000, 'usr-06', true, false, 'Bank', 'Anil Gupta'],
  ['emp-05', 'Karan Singh', 'Male', 'Sales', 'Sales Executive', 'Permanent', 810, 'General', 'Sunday', 'Monthly', 28000, 'usr-09', true, false, 'Bank', 'Mahendra Singh'],
  ['emp-06', 'Arjun Mehra', 'Male', 'Sales', 'Sales Executive', 'Probation', 150, 'General', 'Sunday', 'Monthly', 24000, 'usr-10', true, false, 'Bank', 'Vinod Mehra'],
  ['emp-07', 'Suresh Yadav', 'Male', 'Stores', 'Store Keeper', 'Permanent', 1830, 'General', 'Sunday', 'Monthly', 22000, 'usr-07', true, false, 'Bank', 'Ram Naresh Yadav'],
  ['emp-08', 'Mohd. Irfan', 'Male', 'Production', 'Production Supervisor', 'Permanent', 1640, 'General', 'Sunday', 'Monthly', 36000, 'usr-08', true, false, 'Bank', 'Mohd. Yusuf'],
  ['emp-09', 'Deepak Chauhan', 'Male', 'Quality', 'QC Inspector', 'Permanent', 905, 'General', 'Sunday', 'Monthly', 21000, 'usr-11', true, true, 'Bank', 'Rajpal Chauhan'],
  ['emp-10', 'Ramesh Pal', 'Male', 'Stores', 'Dispatch In-charge', 'Permanent', 1420, 'General', 'Sunday', 'Monthly', 20000, '', true, true, 'Bank', 'Shyam Lal Pal'],
  ['emp-11', 'Kavita Singh', 'Female', 'Management', 'HR & Admin Executive', 'Permanent', 610, 'General', 'Sunday', 'Monthly', 26000, '', true, false, 'Bank', 'Devendra Singh'],
  ['emp-12', 'Rafiq Ahmed', 'Male', 'Production', 'Die-casting Operator', 'Permanent', 1710, 'Morning', 'Friday', 'Monthly', 17500, '', true, true, 'Bank', 'Shafiq Ahmed'],
  ['emp-13', 'Sunil Kumar', 'Male', 'Production', 'Machine Operator', 'Permanent', 1215, 'General', 'Sunday', 'Monthly', 16500, '', true, true, 'Bank', 'Harish Chandra'],
  ['emp-14', 'Mukesh Yadav', 'Male', 'Production', 'Machine Operator', 'Permanent', 960, 'Evening', 'Sunday', 'Monthly', 16000, '', true, true, 'Bank', 'Lalta Prasad'],
  ['emp-15', 'Salim Ansari', 'Male', 'Production', 'Buffing Operator', 'Permanent', 1015, 'Morning', 'Sunday', 'Monthly', 15500, '', true, true, 'Bank', 'Kalim Ansari'],
  ['emp-16', 'Ravi Shankar', 'Male', 'Production', 'Assembly Worker', 'Permanent', 705, 'General', 'Sunday', 'Monthly', 15000, '', true, true, 'Bank', 'Shiv Shankar'],
  ['emp-17', 'Imran Qureshi', 'Male', 'Production', 'Die-casting Operator', 'Contract', 410, 'Evening', 'Friday', 'Monthly', 15000, '', true, true, 'Bank', 'Salman Qureshi'],
  ['emp-18', 'Geeta Devi', 'Female', 'Packaging', 'Packer', 'Permanent', 1120, 'General', 'Sunday', 'Monthly', 13500, '', true, true, 'Bank', 'Mahesh Chand'],
  ['emp-19', 'Shabnam Begum', 'Female', 'Production', 'Assembly Worker', 'Permanent', 655, 'General', 'Sunday', 'Monthly', 13500, '', true, true, 'Bank', 'Nasir Khan'],
  ['emp-20', 'Sanjay Tomar', 'Male', 'Maintenance', 'Maintenance Fitter', 'Permanent', 1300, 'General', 'Sunday', 'Monthly', 19000, '', true, true, 'Bank', 'Brijesh Tomar'],
  ['emp-21', 'Arif Khan', 'Male', 'Operations', 'Driver', 'Permanent', 890, 'General', 'Sunday', 'Monthly', 16000, '', true, true, 'Bank', 'Akhtar Khan'],
  ['emp-22', 'Rekha Kumari', 'Female', 'Packaging', 'Packer', 'Daily Wage', 300, 'General', 'Sunday', 'Daily', 520, '', false, true, 'Cash', 'Bhagwan Das'],
  ['emp-23', 'Pappu Singh', 'Male', 'Production', 'Helper', 'Daily Wage', 250, 'General', 'Sunday', 'Daily', 480, '', false, true, 'Cash', 'Jaswant Singh'],
  ['emp-24', 'Mohit Sharma', 'Male', 'Production', 'Buffing Operator', 'Contract', 200, 'Morning', 'Sunday', 'Daily', 600, '', false, true, 'Bank', 'Naresh Sharma'],
  ['emp-25', 'Priya Saxena', 'Female', 'Accounts', 'Accounts Executive', 'Probation', 18, 'General', 'Sunday', 'Monthly', 22000, '', true, false, 'Bank', 'Alok Saxena'],
]

// [MM-DD, name, type] — festival dates are indicative and repeat every year in the demo
const HOLIDAYS = [
  ['01-26', 'Republic Day', 'National'],
  ['03-04', 'Holi', 'Festival'],
  ['03-21', 'Eid-ul-Fitr', 'Festival'],
  ['04-14', 'Dr. Ambedkar Jayanti', 'National'],
  ['08-15', 'Independence Day', 'National'],
  ['08-28', 'Raksha Bandhan', 'Festival'],
  ['09-04', 'Janmashtami', 'Festival'],
  ['10-02', 'Gandhi Jayanti', 'National'],
  ['10-20', 'Dussehra', 'Festival'],
  ['11-08', 'Diwali', 'Festival'],
  ['11-09', 'Govardhan Puja', 'Festival'],
  ['11-11', 'Bhai Dooj', 'Festival'],
  ['12-25', 'Christmas', 'Festival'],
]

const LEAVE_TYPES = [
  { id: 'lt-cl', name: 'Casual Leave', code: 'CL', paid: true, annualQuota: 12, carryForward: false, maxCarryForward: 0, encashable: false, allowHalfDay: true, maxConsecutive: 3, noticeDays: 1, gender: 'All', description: 'Short personal work or emergencies. Not more than 3 days at a time.' },
  { id: 'lt-sl', name: 'Sick Leave', code: 'SL', paid: true, annualQuota: 7, carryForward: false, maxCarryForward: 0, encashable: false, allowHalfDay: true, maxConsecutive: 0, noticeDays: 0, gender: 'All', description: 'Illness or injury. Medical certificate needed for more than 2 days.' },
  { id: 'lt-el', name: 'Earned Leave', code: 'EL', paid: true, annualQuota: 15, carryForward: true, maxCarryForward: 30, encashable: true, allowHalfDay: false, maxConsecutive: 0, noticeDays: 7, gender: 'All', description: 'Planned leave earned for days worked. Apply at least 7 days in advance.' },
  { id: 'lt-lwp', name: 'Leave Without Pay', code: 'LWP', paid: false, annualQuota: 0, carryForward: false, maxCarryForward: 0, encashable: false, allowHalfDay: true, maxConsecutive: 0, noticeDays: 0, gender: 'All', description: 'Unpaid leave once paid leave is exhausted. Deducted from salary.' },
  { id: 'lt-ml', name: 'Maternity Leave', code: 'ML', paid: true, annualQuota: 182, carryForward: false, maxCarryForward: 0, encashable: false, allowHalfDay: false, maxConsecutive: 0, noticeDays: 30, gender: 'Female', description: 'As per the Maternity Benefit Act — 26 weeks for the first two children.' },
]

// Permission shorthand: v=view a=add e=edit d=delete p=approve r=print x=export
// Payroll (salary generation and approval) is reserved for the owner by default.
const ROLE_PERMS = {
  'Super Admin': { '*': 'vaedprx' },
  Admin: { '*': 'vaedprx', Payroll: 'vrx' },
  Manager: { '*': 'vaeprx', 'Users & Access': 'v', Settings: 'v', Payroll: '' },
  Accountant: { Dashboard: 'v', Accounts: 'vaedprx', Sales: 'vrx', Purchase: 'vrx', Reports: 'vrx', Masters: 'vae', Inventory: 'v', HR: 'v', Payroll: 'vrx' },
  'Purchase User': { Dashboard: 'v', Purchase: 'vaerx', Inventory: 'v', Quality: 'v', Masters: 'va', Reports: 'vr' },
  'Sales User': { Dashboard: 'v', Sales: 'vaerx', Inventory: 'v', Masters: 'va', Reports: 'vr', Accounts: 'v' },
  'Store User': { Dashboard: 'v', Inventory: 'vaer', Purchase: 'va', Production: 'v', Quality: 'va', Masters: 'v', Reports: 'v' },
  'Production User': { Dashboard: 'v', Production: 'vaer', Quality: 'vaer', Inventory: 'v', Masters: 'v', Reports: 'v', HR: 'va' },
  Employee: { Dashboard: 'v', Quality: 'v', Reports: 'v' },
}
const ROLE_DESC = {
  'Super Admin': 'Full access to every module, including users and company settings',
  Admin: 'Manages masters, users and day-to-day configuration',
  Manager: 'Approves orders and oversees purchase, sales, stores and production',
  Accountant: 'Receipts, payments, ledgers, outstanding and GST reports',
  'Purchase User': 'Creates requisitions, purchase orders and supplier invoices',
  'Sales User': 'Creates quotations, sales orders and invoices',
  'Store User': 'Handles GRN, stock movements, transfers and adjustments',
  'Production User': 'Production orders, stage output, job work, QC and production entries',
  Employee: 'Read-only access to dashboard and reports',
}

export function buildPermissions(role) {
  const spec = ROLE_PERMS[role] || {}
  const letters = { view: 'v', add: 'a', edit: 'e', delete: 'd', approve: 'p', print: 'r', export: 'x' }
  const out = {}
  PERMISSION_MODULES.forEach((m) => {
    const s = spec[m] ?? spec['*'] ?? ''
    out[m] = {}
    PERMISSION_TYPES.forEach((p) => {
      out[m][p] = s.includes(letters[p])
    })
  })
  return out
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

export function buildSeedData() {
  const rand = mulberry32(914260)
  const ri = (a, b) => Math.floor(rand() * (b - a + 1)) + a
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const chance = (p) => rand() < p
  const shuffle = (arr) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  const TODAY = today()
  const ago = (n) => addDays(TODAY, -n)
  const pad = (n) => String(n).padStart(2, '0')
  const at = (date, h = ri(9, 18), m = ri(0, 59)) => `${date}T${pad(h)}:${pad(m)}:00`
  const dow = (iso) => new Date(`${iso}T00:00:00`).getDay()
  const workday = (iso) => (dow(iso) === 0 ? addDays(iso, 1) > TODAY ? addDays(iso, -1) : addDays(iso, 1) : iso)
  const clampToday = (iso) => (iso > TODAY ? TODAY : iso)
  let lineSeq = 0
  const lid = () => `ln-${++lineSeq}`
  const RECENT = 45
  const termDays = (t) => parseInt(t, 10) || 0

  const panFor = (name, kind = 'F') => {
    const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    return `${L[ri(0, 23)]}${L[ri(0, 23)]}${L[ri(0, 23)]}${kind}${name[0].toUpperCase()}${ri(1000, 9999)}${L[ri(0, 23)]}`
  }
  const gstinFor = (state, name, kind) => `${stateCode(state)}${panFor(name, kind)}1Z${'0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[ri(0, 33)]}`
  const mobile = () => `+91 ${ri(70000, 99999)} ${ri(10000, 99999)}`
  const emailFor = (name, domainHint) => {
    const slug = name.toLowerCase().replace(/&/g, '').replace(/[^a-z]+/g, '').slice(0, 16)
    return `${pick(['info', 'accounts', 'sales', 'purchase'])}@${slug}${domainHint || '.in'}`
  }

  const created = ago(420)

  const categories = CATEGORIES.map(([name, description], i) => ({ id: `cat-${i + 1}`, name, description, status: 'Active', createdAt: at(created) }))
  const brands = BRANDS.map(([name, description], i) => ({ id: `brd-${i + 1}`, name, description, status: 'Active', createdAt: at(created) }))
  const units = UNITS.map(([name, description, decimals], i) => ({ id: `unt-${i + 1}`, name, description, decimals, status: 'Active', createdAt: at(created) }))
  const warehouses = WAREHOUSES.map(([id, name, code, address, contactPerson, phone, status]) => ({ id, name, code, address, contactPerson, phone, status, createdAt: at(created) }))

  const OPENING_DATE = ago(RECENT + 1)
  const items = ITEMS.map(([id, code, name, category, subCategory, brand, unit, hsn, gst, purchaseRate, salesRate, minStock, type, warehouseId]) => ({
    id, code, name, category, subCategory, brand, unit, hsn, gst, purchaseRate, salesRate, minStock,
    openingStock: 0, openingDate: OPENING_DATE, warehouseId, type, status: 'Active', description: '', createdAt: at(created),
    ...(FAMILY_OF[id] ? { familyId: FAMILY_OF[id][0], attributes: FAMILY_OF[id][1] } : {}),
  }))
  const productFamilies = FAMILIES.map((f) => ({ ...f, attributes: f.attributes.map((a) => ({ ...a, values: [...a.values], adjust: { ...a.adjust } })), status: 'Active', createdAt: at(created) }))
  items.push({
    id: 'fg-1015', code: 'FG-1015', name: 'Door Chain Guard Antique', category: 'Accessories', subCategory: 'Door Guards', brand: 'Aligarh Classic',
    unit: 'PCS', hsn: '83024190', gst: 18, purchaseRate: 88, salesRate: 165, minStock: 0, openingStock: 0, openingDate: OPENING_DATE,
    warehouseId: 'wh-fgg', type: 'Finished Good', status: 'Inactive', description: 'Discontinued – replaced by SteelCraft range', createdAt: at(created),
  })
  const TARGET = Object.fromEntries(ITEMS.map((r) => [r[0], r[14]]))
  const itemById = Object.fromEntries(items.map((i) => [i.id, i]))

  const customers = CUSTOMERS.map(([name, legal, contact, address, city, state, terms, credit, opening, status, weight], i) => ({
    id: `cus-${pad(i + 1)}`, code: `CUS-${String(i + 1).padStart(4, '0')}`, name, companyName: legal, contactPerson: contact,
    mobile: mobile(), email: emailFor(name), gstin: gstinFor(state, name, legal.includes('Pvt') ? 'C' : 'F'),
    address, city, state, pincode: PINCODES[city] || '', creditLimit: credit, paymentTerms: terms, openingBalance: opening, status,
    weight, createdAt: at(ago(ri(200, 400))),
  }))
  const suppliers = SUPPLIERS.map(([name, legal, contact, address, city, state, terms, opening, itemIds], i) => ({
    id: `sup-${pad(i + 1)}`, code: `SUP-${String(i + 1).padStart(4, '0')}`, name, companyName: legal, contactPerson: contact,
    mobile: mobile(), email: emailFor(name), gstin: gstinFor(state, name, legal.includes('Pvt') ? 'C' : 'F'),
    address, city, state, pincode: PINCODES[city] || '', paymentTerms: terms, openingBalance: opening, status: 'Active',
    itemIds, createdAt: at(ago(ri(250, 400))),
  }))
  const custById = Object.fromEntries(customers.map((c) => [c.id, c]))
  const supById = Object.fromEntries(suppliers.map((s) => [s.id, s]))
  const activeCustomers = customers.filter((c) => c.status === 'Active')
  const totalWeight = activeCustomers.reduce((a, c) => a + c.weight, 0)
  const pickCustomer = () => {
    let r = rand() * totalWeight
    for (const c of activeCustomers) {
      r -= c.weight
      if (r <= 0) return c
    }
    return activeCustomers[0]
  }

  /* ---------------- Sales ---------------- */
  const salesInvoices = []
  const salesOrders = []
  const deliveryChallans = []
  const quotations = []
  const salesReturns = []
  const receipts = []

  const sellable = items.filter((i) => ['Finished Good', 'Trading Goods'].includes(i.type) && i.status === 'Active')
  const recentSellable = sellable.filter((i) => TARGET[i.id] >= 150)

  const salesLines = (pool, n, scale = 1) =>
    shuffle(pool)
      .slice(0, n)
      .map((item) => {
        const value = ri(14000, 52000) * scale
        const step = item.salesRate > 2000 ? 1 : item.salesRate > 400 ? 5 : 10
        const qty = Math.max(step, Math.round(value / item.salesRate / step) * step)
        return { id: lid(), itemId: item.id, qty, rate: item.salesRate, discount: pick([0, 0, 0, 2, 2.5, 5]), gst: item.gst }
      })

  const scaleLines = (lines, customer, target) => {
    const total = calcTotals(lines, { interState: isInterState(customer.state) }).grandTotal
    const f = target / total
    return lines.map((l) => {
      const step = l.rate > 2000 ? 1 : l.rate > 400 ? 5 : 10
      return { ...l, qty: Math.max(step, Math.round((l.qty * f) / step) * step) }
    })
  }

  const refFor = (mode) =>
    mode === 'Bank'
      ? `NEFT UTR ${pick(['HDFCN', 'SBINR', 'ICICN', 'PUNBH', 'UTIBN'])}${ri(10000000, 99999999)}`
      : mode === 'UPI'
        ? `UPI Ref ${ri(400000, 499999)}${ri(100000, 999999)}`
        : mode === 'Cheque'
          ? `Cheque No. ${ri(100000, 999999)} (${pick(['SBI', 'PNB', 'HDFC Bank', 'Bank of Baroda'])})`
          : `Cash Memo ${ri(1000, 9999)}`

  const makeInvoice = ({ date, customer, lines, soId = null, dcId = null, salesPerson, historical = false }) => {
    const totals = calcTotals(lines, { interState: isInterState(customer.state) })
    const addr = `${customer.address}, ${customer.city}, ${customer.state} ${customer.pincode}`
    const inv = {
      id: `inv-${salesInvoices.length + 1}`, number: '', date, dueDate: addDays(date, termDays(customer.paymentTerms)),
      customerId: customer.id, soId, dcId, warehouseId: 'wh-fgg', salesPerson: salesPerson || pick(SALES_PERSONS),
      billingAddress: addr, shippingAddress: addr, placeOfSupply: customer.state, lines, totals, notes: '',
      sentAt: chance(0.6) ? at(date) : null, historical, createdAt: at(date),
    }
    salesInvoices.push(inv)
    return inv
  }

  const addReceipt = (inv, amount, date) => {
    const d = clampToday(date < inv.date ? inv.date : date)
    const mode = amount > 150000 ? pick(['Bank', 'Bank', 'Cheque']) : pick(['Bank', 'Bank', 'Bank', 'UPI', 'UPI', 'Cheque', 'Cash'])
    const full = amount >= inv.totals.grandTotal - 1
    receipts.push({
      id: `rct-${receipts.length + 1}`, number: '', date: d, customerId: inv.customerId, invoiceId: inv.id, amount: Math.round(amount), mode,
      accountId: mode === 'Cash' ? 'acc-cash' : mode === 'Cheque' && chance(0.4) ? 'acc-icici' : 'acc-hdfc',
      reference: refFor(mode), remarks: full ? 'Full settlement' : 'Part payment against invoice', createdAt: at(d),
    })
  }

  // Historical invoices (direct, no stock effect — stock history starts at opening date)
  for (let age = 365; age > RECENT; age--) {
    const date = ago(age)
    if (dow(date) === 0) continue
    const month = new Date(`${date}T00:00:00`).getMonth()
    const season = [0.95, 0.95, 1.12, 0.92, 0.95, 0.9, 0.9, 0.95, 1.0, 1.15, 1.2, 1.05][month]
    const growth = 0.72 + 0.22 * (1 - age / 365)
    const count = chance(0.55) ? 1 : chance(0.45) ? 2 : 0
    for (let k = 0; k < count; k++) {
      const customer = pickCustomer()
      const inv = makeInvoice({ date, customer, lines: salesLines(sellable, ri(2, 4), season * growth), historical: true })
      const total = inv.totals.grandTotal
      const due = termDays(customer.paymentTerms)
      if (age > 80 || chance(0.72)) {
        const payDate = addDays(date, Math.max(2, due + ri(-8, 10)))
        if (payDate <= TODAY) addReceipt(inv, total, payDate)
        else addReceipt(inv, Math.round((total * 0.5) / 1000) * 1000, addDays(date, ri(5, 15)))
      } else if (chance(0.55)) {
        addReceipt(inv, Math.round((total * pick([0.4, 0.5, 0.6])) / 1000) * 1000, addDays(date, ri(7, 25)))
      }
    }
  }

  const transport = (customer, date) => {
    const t = pick(TRANSPORTERS)
    return {
      transporter: t,
      vehicleNo: `UP81 ${pick(['AT', 'BT', 'CT', 'DT', 'FT'])} ${ri(1000, 9999)}`,
      lrNo: t === 'Own Vehicle' ? '' : `LR-${ri(40000, 89999)}`,
      driverName: pick(['Rakesh Yadav', 'Shiv Kumar', 'Mukesh Pal', 'Salim Khan', 'Rajendra Singh']),
      driverMobile: mobile(),
      ewayBill: `${ri(1000, 9999)} ${ri(1000, 9999)} ${ri(1000, 9999)}`,
      destination: customer.city,
      dispatchedAt: at(date, ri(10, 17)),
    }
  }

  const makeSO = (date, customer, lines, extra = {}) => {
    const so = {
      id: `so-${salesOrders.length + 1}`, number: '', date, customerId: customer.id, deliveryDate: addDays(date, ri(4, 10)),
      salesPerson: pick(SALES_PERSONS), quotationId: null, customerPoNo: `${customer.name.split(' ')[0].toUpperCase()}/PO/${ri(100, 999)}`,
      lines, remarks: pick(['', '', 'Deliver in two lots if required', 'Urgent – site work starting', 'Pack in master cartons with party marking']),
      status: 'Confirmed', totals: calcTotals(lines, { interState: isInterState(customer.state) }), createdAt: at(date), ...extra,
    }
    salesOrders.push(so)
    return so
  }
  const makeDC = (so, date, fraction = 1) => {
    const customer = custById[so.customerId]
    const lines = so.lines.map((l, idx) => {
      const step = l.rate > 2000 ? 1 : 5
      const delivered = fraction >= 1 ? l.qty : idx === so.lines.length - 1 ? 0 : Math.max(step, Math.floor((l.qty * fraction) / step) * step)
      return { id: lid(), itemId: l.itemId, orderedQty: l.qty, deliveredQty: delivered, rate: l.rate }
    })
    const dc = {
      id: `dc-${deliveryChallans.length + 1}`, number: '', date, customerId: so.customerId, soId: so.id, warehouseId: 'wh-fgg',
      lines, transport: transport(customer, date), status: fraction >= 1 ? 'Delivered' : 'Dispatched', remarks: '', createdAt: at(date),
    }
    deliveryChallans.push(dc)
    return dc
  }
  const invoiceFromDC = (so, dc, date) =>
    makeInvoice({
      date,
      customer: custById[so.customerId],
      lines: dc.lines.filter((l) => l.deliveredQty > 0).map((l) => {
        const sl = so.lines.find((x) => x.itemId === l.itemId)
        return { id: lid(), itemId: l.itemId, qty: l.deliveredQty, rate: sl.rate, discount: sl.discount, gst: sl.gst }
      }),
      soId: so.id,
      dcId: dc.id,
      salesPerson: so.salesPerson,
    })

  const QT_TERMS = 'Prices are ex-works Aligarh.\nGST extra as applicable.\nDelivery within 7–10 working days from order confirmation.\nFreight to be borne by the buyer.'
  const makeQuotation = (date, customer, lines, status, extra = {}) => {
    const q = {
      id: `qt-${quotations.length + 1}`, number: '', date, customerId: customer.id, validTill: addDays(date, 15), salesPerson: pick(SALES_PERSONS),
      lines: lines.map((l) => ({ ...l, id: lid() })), terms: QT_TERMS,
      notes: pick(['Special price for bulk order', 'Samples shared with purchase team', 'Revised as per discussion with party', '']),
      status, totals: calcTotals(lines, { interState: isInterState(customer.state) }), createdAt: at(date), ...extra,
    }
    quotations.push(q)
    return q
  }

  // Recent sales orders with full chain
  for (let age = RECENT; age >= 0; age--) {
    const date = ago(age)
    if (dow(date) === 0) continue
    const n = age <= 2 ? 1 : chance(0.15) ? 2 : chance(0.8) ? 1 : 0
    for (let k = 0; k < n; k++) {
      const customer = pickCustomer()
      const lines = salesLines(recentSellable, ri(2, 4), 1.05)
      let quotationId = null
      if (age > 4 && chance(0.3)) {
        quotationId = makeQuotation(ago(age + ri(2, 5)), customer, lines, 'Accepted').id
      }
      const so = makeSO(date, customer, lines, { quotationId })
      if (age === 20) {
        so.status = 'Cancelled'
        so.remarks = 'Party postponed the project – order cancelled'
        continue
      }
      if (age >= 8) {
        const dcDate = workday(clampToday(addDays(date, ri(1, 3))))
        const dc = makeDC(so, dcDate)
        const inv = invoiceFromDC(so, dc, dcDate)
        const due = termDays(customer.paymentTerms)
        const total = inv.totals.grandTotal
        const r = rand()
        if (age >= 30) {
          if (r < 0.86) addReceipt(inv, total, addDays(dcDate, Math.min(ri(8, due + 3), age - 1)))
          else if (r < 0.95) addReceipt(inv, Math.round((total * 0.5) / 1000) * 1000, addDays(dcDate, ri(6, 15)))
        } else if (r < 0.5) addReceipt(inv, total, addDays(dcDate, ri(2, Math.max(3, age - 3))))
        else if (r < 0.75) addReceipt(inv, Math.round((total * pick([0.3, 0.5])) / 1000) * 1000, addDays(dcDate, ri(1, Math.max(2, age - 4))))
      } else if (age >= 3) {
        const r = rand()
        if (r < 0.5) {
          const dcDate = addDays(date, 1)
          const dc = makeDC(so, dcDate)
          invoiceFromDC(so, dc, dcDate)
        } else if (r < 0.8) {
          makeDC(so, addDays(date, 1), 0.6)
        }
      } else if (age === 0) {
        so.status = 'Pending'
      }
    }
  }

  // Today's invoices (~₹4.85 L)
  ;[
    [4, 'cus-02', 192000],
    [5, 'cus-10', 164000],
    [6, 'cus-03', 129000],
  ].forEach(([age, cid, target]) => {
    const customer = custById[cid]
    const lines = scaleLines(salesLines(recentSellable, 3, 1.4), customer, target)
    const so = makeSO(ago(age), customer, lines)
    const dc = makeDC(so, ago(1))
    invoiceFromDC(so, dc, TODAY)
  })

  // Standalone quotations
  ;[
    [0, 'Draft'], [1, 'Draft'], [3, 'Sent'], [5, 'Sent'], [8, 'Sent'], [2, 'Accepted'], [4, 'Accepted'],
    [12, 'Rejected'], [26, 'Expired'], [33, 'Expired'], [18, 'Rejected'],
  ].forEach(([age, status]) => {
    const customer = pickCustomer()
    makeQuotation(ago(age), customer, salesLines(recentSellable, ri(2, 5), 1.1), status)
  })

  // Sales returns
  const recentInvoices = salesInvoices.filter((i) => !i.historical && i.date < ago(4))
  const SR_REASONS = ['Damaged in transit', 'Wrong finish supplied (antique instead of satin)', 'Excess quantity supplied', 'Key mechanism defect reported by party', 'Packing damaged – party refused']
  shuffle(recentInvoices).slice(0, 5).forEach((inv, i) => {
    const date = clampToday(addDays(inv.date, ri(3, 9)))
    const l = inv.lines[0]
    const qty = Math.max(2, Math.round((l.qty * ri(5, 15)) / 100))
    const reason = SR_REASONS[i]
    salesReturns.push({
      id: `srn-${i + 1}`, number: '', date, customerId: inv.customerId, invoiceId: inv.id,
      warehouseId: reason.startsWith('Damaged') || reason.startsWith('Key') ? 'wh-scr' : 'wh-fgg',
      lines: [{ id: lid(), itemId: l.itemId, qty, rate: l.rate, gst: l.gst }],
      reason, amount: Math.round(qty * l.rate * (1 + l.gst / 100)), status: i < 3 ? 'Credit Note Issued' : i === 3 ? 'Approved' : 'Pending',
      remarks: '', createdAt: at(date),
    })
  })

  /* ---------------- Purchase ---------------- */
  const purchaseOrders = []
  const grns = []
  const purchaseInvoices = []
  const purchaseReturns = []
  const payments = []
  const purchaseRequisitions = []

  const purchaseLines = (supplier, n, scale = 1) =>
    shuffle(supplier.itemIds)
      .slice(0, Math.min(n, supplier.itemIds.length))
      .map((id) => {
        const item = itemById[id]
        const value = ri(18000, 70000) * scale
        const step = item.unit === 'KG' ? 10 : item.purchaseRate < 5 ? 500 : item.purchaseRate < 20 ? 100 : item.purchaseRate < 100 ? 50 : item.purchaseRate < 1000 ? 10 : 1
        const qty = Math.max(step, Math.round(value / item.purchaseRate / step) * step)
        return { id: lid(), itemId: id, qty, rate: item.purchaseRate, discount: pick([0, 0, 0, 1, 2]), gst: item.gst }
      })

  const supplierInvNo = (s, date) => `${s.name.replace(/[^A-Z]/g, '').slice(0, 3) || 'INV'}/${ri(100, 2999)}/${date.slice(2, 4)}-${String(Number(date.slice(2, 4)) + 1).padStart(2, '0')}`

  const addPayment = (inv, amount, date) => {
    const d = clampToday(date < inv.date ? inv.date : date)
    const mode = amount > 100000 ? pick(['Bank', 'Bank', 'Cheque']) : pick(['Bank', 'Bank', 'UPI', 'Cheque', 'Cash'])
    payments.push({
      id: `pay-${payments.length + 1}`, number: '', date: d, supplierId: inv.supplierId, invoiceId: inv.id, amount: Math.round(amount), mode,
      accountId: mode === 'Cash' ? 'acc-cash' : mode === 'Cheque' && chance(0.5) ? 'acc-icici' : 'acc-hdfc',
      reference: refFor(mode), remarks: amount >= inv.totals.grandTotal - 1 ? 'Full payment' : 'Part payment', createdAt: at(d),
    })
  }

  const makePI = ({ date, supplier, lines, grnId = null, poId = null, warehouseId, historical = false }) => {
    const inv = {
      id: `pinv-${purchaseInvoices.length + 1}`, number: '', supplierInvoiceNo: supplierInvNo(supplier, date), date,
      dueDate: addDays(date, termDays(supplier.paymentTerms)), supplierId: supplier.id, grnId, poId, warehouseId,
      lines, totals: calcTotals(lines, { interState: isInterState(supplier.state) }), remarks: '', historical, createdAt: at(date),
    }
    purchaseInvoices.push(inv)
    return inv
  }

  const activeSuppliers = suppliers
  for (let age = 365; age > RECENT; age--) {
    const date = ago(age)
    if (dow(date) === 0 || !chance(0.6)) continue
    const supplier = pick(activeSuppliers)
    const lines = purchaseLines(supplier, ri(1, 3))
    const inv = makePI({ date, supplier, lines, warehouseId: itemById[lines[0].itemId].warehouseId, historical: true })
    const due = termDays(supplier.paymentTerms)
    if (age > 75 || chance(0.75)) addPayment(inv, inv.totals.grandTotal, addDays(date, Math.max(1, due + ri(-5, 8))))
    else if (chance(0.5)) addPayment(inv, Math.round((inv.totals.grandTotal * 0.5) / 1000) * 1000, addDays(date, ri(5, 20)))
  }

  const PO_TERMS = '1. Material must conform to approved sample and drawing.\n2. Test certificate to accompany each consignment.\n3. Rejected material will be returned at supplier’s cost.\n4. Payment as per agreed credit terms from date of GRN.'
  const makePO = (date, supplier, lines, status, extra = {}) => {
    const po = {
      id: `po-${purchaseOrders.length + 1}`, number: '', date, supplierId: supplier.id, expectedDate: addDays(date, ri(5, 12)),
      warehouseId: itemById[lines[0].itemId].warehouseId, reference: pick([`Quote ${supplier.name.slice(0, 3).toUpperCase()}/Q/${ri(100, 999)}`, 'Rate contract FY 26-27', 'Telephonic confirmation', '']),
      prId: null, lines, terms: PO_TERMS, remarks: pick(['', '', 'Deliver to Talanagri Unit 2 gate', 'Urgent – production line waiting']),
      status, totals: calcTotals(lines, { interState: isInterState(supplier.state) }), createdAt: at(date), ...extra,
    }
    purchaseOrders.push(po)
    return po
  }
  const makeGRN = (po, date, fraction = 1) => {
    const lines = po.lines.map((l, idx) => {
      const received = fraction >= 1 ? l.qty : idx === po.lines.length - 1 && po.lines.length > 1 ? 0 : Math.round(l.qty * fraction)
      const rejected = received > 0 && chance(0.2) ? Math.max(1, Math.round(received * pick([0.01, 0.02, 0.03]))) : 0
      return { id: lid(), itemId: l.itemId, orderedQty: l.qty, receivedQty: received, rejectedQty: rejected, acceptedQty: received - rejected, rate: l.rate }
    })
    const supplier = supById[po.supplierId]
    const grn = {
      id: `grn-${grns.length + 1}`, number: '', date, supplierId: po.supplierId, poId: po.id, warehouseId: po.warehouseId, lines,
      supplierChallanNo: `DC-${ri(1000, 9999)}`, vehicleNo: `${pick(['UP81', 'DL1L', 'RJ27', 'HR51', 'PB10', 'GJ10'])} ${pick(['AB', 'CK', 'GA', 'T'])} ${ri(1000, 9999)}`,
      qcBy: pick(['Deepak Chauhan', 'Suresh Yadav']), status: 'Completed',
      remarks: lines.some((l) => l.rejectedQty) ? 'Part quantity rejected in QC – debit note to be raised' : `Received in good condition from ${supplier.name}`,
      createdAt: at(date),
    }
    grns.push(grn)
    return grn
  }
  const piFromGRN = (po, grn, date) =>
    makePI({
      date,
      supplier: supById[po.supplierId],
      lines: grn.lines.filter((l) => l.acceptedQty > 0).map((l) => {
        const pl = po.lines.find((x) => x.itemId === l.itemId)
        return { id: lid(), itemId: l.itemId, qty: l.acceptedQty, rate: pl.rate, discount: pl.discount, gst: pl.gst }
      }),
      grnId: grn.id,
      poId: po.id,
      warehouseId: po.warehouseId,
    })

  // Ensure raw-material-heavy suppliers appear regularly
  const rmSuppliers = suppliers.filter((s) => s.itemIds.some((id) => id.startsWith('rm') || id.startsWith('pk')))
  for (let age = RECENT; age >= 0; age--) {
    const date = ago(age)
    if (dow(date) === 0 || !chance(0.5)) continue
    const supplier = chance(0.8) ? pick(rmSuppliers) : pick(suppliers)
    const lines = purchaseLines(supplier, ri(1, 3), 1.1)
    if (age >= 11) {
      const po = makePO(date, supplier, lines, 'Approved')
      if (age === 27) {
        po.status = 'Cancelled'
        po.remarks = 'Rates revised by supplier – order cancelled'
        continue
      }
      const grnDate = workday(clampToday(addDays(date, ri(3, 7))))
      const grn = makeGRN(po, grnDate)
      const inv = piFromGRN(po, grn, grnDate)
      const r = rand()
      if (age >= 30 ? r < 0.66 : r < 0.3) addPayment(inv, inv.totals.grandTotal, addDays(grnDate, ri(5, Math.max(6, age - 6))))
      else if (r < 0.55) addPayment(inv, Math.round((inv.totals.grandTotal * 0.5) / 1000) * 1000, addDays(grnDate, ri(2, Math.max(3, age - 8))))
    } else if (age >= 5) {
      const po = makePO(date, supplier, lines, 'Approved')
      if (chance(0.5)) {
        const grnDate = addDays(date, ri(2, 4))
        const grn = makeGRN(po, grnDate, 0.6)
        piFromGRN(po, grn, grnDate)
      }
    } else {
      makePO(date, supplier, lines, age <= 1 ? pick(['Draft', 'Submitted']) : pick(['Submitted', 'Approved']))
    }
  }

  // Today's purchases (~₹2.4 L)
  ;[
    [6, 'sup-01', 1.25],
    [8, 'sup-06', 0.75],
    [7, 'sup-08', 0.8],
  ].forEach(([age, sid, scale]) => {
    const supplier = supById[sid]
    const po = makePO(ago(age), supplier, purchaseLines(supplier, 2, scale), 'Approved')
    const grn = makeGRN(po, TODAY)
    piFromGRN(po, grn, TODAY)
  })

  // Requisitions
  const DEPTS = ['Production', 'Stores', 'Maintenance', 'Packaging']
  const REQUESTERS = { Production: 'Mohd. Irfan', Stores: 'Suresh Yadav', Maintenance: 'Deepak Chauhan', Packaging: 'Ramesh Pal' }
  const recentPOsForPR = purchaseOrders.filter((p) => p.date >= ago(28) && p.date <= ago(3) && p.status !== 'Cancelled').slice(0, 3)
  recentPOsForPR.forEach((po, i) => {
    const date = addDays(po.date, -ri(2, 4))
    const dept = i === 2 ? 'Packaging' : 'Production'
    const pr = {
      id: `pr-${purchaseRequisitions.length + 1}`, number: '', date, department: dept, requestedBy: REQUESTERS[dept], requiredDate: addDays(date, 7),
      lines: po.lines.map((l) => ({ id: lid(), itemId: l.itemId, qty: l.qty })), remarks: 'Stock below reorder level', status: 'Approved', createdAt: at(date),
    }
    purchaseRequisitions.push(pr)
    po.prId = pr.id
  })
  ;[
    [0, 'Pending', 'Production', ['rm-3003', 'rm-3006']],
    [1, 'Pending', 'Stores', ['pk-4001', 'pk-4003']],
    [2, 'Approved', 'Production', ['rm-3009']],
    [4, 'Approved', 'Maintenance', ['rm-3013']],
    [6, 'Pending', 'Production', ['rm-3001', 'rm-3002', 'rm-3011']],
    [9, 'Rejected', 'Stores', ['rm-3010']],
    [15, 'Approved', 'Packaging', ['pk-4002']],
  ].forEach(([age, status, dept, ids]) => {
    const date = ago(age)
    purchaseRequisitions.push({
      id: `pr-${purchaseRequisitions.length + 1}`, number: '', date, department: dept, requestedBy: REQUESTERS[dept], requiredDate: addDays(date, ri(5, 12)),
      lines: ids.map((id) => {
        const it = itemById[id]
        const step = it.unit === 'KG' ? 10 : it.purchaseRate < 20 ? 500 : 50
        return { id: lid(), itemId: id, qty: Math.round(ri(20000, 60000) / it.purchaseRate / step) * step || step }
      }),
      remarks: status === 'Rejected' ? 'Sufficient stock available – rejected by manager' : pick(['Required for upcoming production orders', 'Reorder level reached', 'Monthly consumption requirement']),
      status, createdAt: at(date),
    })
  })

  // Purchase returns
  const PR_REASONS = ['Rejected in QC – dimension mismatch', 'Plating defects on castings', 'Short hardness on shackles', 'Wrong grade supplied (SS 202 instead of 304)']
  shuffle(purchaseInvoices.filter((i) => !i.historical && i.grnId && i.date < ago(3))).slice(0, 4).forEach((inv, i) => {
    const l = inv.lines[0]
    const qty = Math.max(1, Math.round((l.qty * ri(3, 8)) / 100))
    const date = clampToday(addDays(inv.date, ri(1, 4)))
    purchaseReturns.push({
      id: `prn-${i + 1}`, number: '', date, supplierId: inv.supplierId, invoiceId: inv.id, warehouseId: inv.warehouseId,
      lines: [{ id: lid(), itemId: l.itemId, qty, rate: l.rate, gst: l.gst }], reason: PR_REASONS[i],
      amount: Math.round(qty * l.rate * (1 + l.gst / 100)), status: i < 2 ? 'Credit Note Issued' : 'Approved', remarks: '', createdAt: at(date),
    })
  })

  /* ---------------- Production ---------------- */
  const boms = BOMS.map(([id, code, productId, version, status, comps]) => ({
    id, code, productId, version, status, unit: itemById[productId].unit, outputQty: 1,
    components: comps.map(([itemId, qty]) => ({ id: lid(), itemId, qty, unit: itemById[itemId].unit, rate: itemById[itemId].purchaseRate })),
    remarks: status === 'Draft' ? 'Under trial – awaiting QC approval' : 'Approved by production head',
    effectiveFrom: ago(ri(120, 300)), createdAt: at(ago(ri(120, 300))),
  }))
  const bomByProduct = Object.fromEntries(boms.filter((b) => b.status === 'Active').map((b) => [b.productId, b]))
  const activeBoms = boms.filter((b) => b.status === 'Active')

  const productionOrders = []
  const materialIssues = []
  const productionEntries = []
  const wastages = []

  const makeProdOrder = (date, bom, plannedQty, priority, status, historical = false) => {
    const po = {
      id: `prd-${productionOrders.length + 1}`, number: '', date, productId: bom.productId, bomId: bom.id, plannedQty,
      warehouseId: 'wh-fgg', rmWarehouseId: 'wh-rms', expectedDate: addDays(date, ri(4, 9)), priority, status,
      remarks: pick(['', 'Against SO backlog', 'Stock replenishment', 'Priority for Delhi Depot', 'Festive season build-up']),
      historical, createdAt: at(date),
    }
    productionOrders.push(po)
    return po
  }
  const makeIssue = (order, date, fraction = 1) => {
    const bom = boms.find((b) => b.id === order.bomId)
    const mi = {
      id: `mi-${materialIssues.length + 1}`, number: '', date, productionOrderId: order.id, warehouseId: 'wh-rms',
      lines: bom.components.map((c) => {
        const required = round2(c.qty * order.plannedQty)
        const issued = itemById[c.itemId].unit === 'KG' ? round2(required * fraction) : Math.ceil(required * fraction)
        return { id: lid(), itemId: c.itemId, requiredQty: required, issuedQty: issued }
      }),
      issuedBy: 'Ramesh Pal', receivedBy: 'Mohd. Irfan', remarks: fraction < 1 ? 'Balance to be issued after GRN' : '',
      historical: order.historical, createdAt: at(date),
    }
    materialIssues.push(mi)
    return mi
  }
  const makeEntry = (order, date, produced) => {
    const rate = LABOUR_RATE[order.productId] || 15
    const rejected = Math.round(produced * pick([0.005, 0.01, 0.015, 0.02]))
    const e = {
      id: `pe-${productionEntries.length + 1}`, number: '', date, productionOrderId: order.id, productId: order.productId, bomId: order.bomId,
      plannedQty: order.plannedQty, producedQty: produced, rejectedQty: rejected, wastageQty: round2(produced * 0.004),
      labourCost: Math.round(produced * rate), otherCost: Math.round(produced * rate * 0.35), freightCost: Math.round(produced * 1.2),
      warehouseId: 'wh-fgg', shift: pick(['Day', 'Day', 'Night']), supervisor: 'Mohd. Irfan',
      remarks: rejected ? 'Rejected pieces moved to scrap yard' : 'Batch passed QC', historical: order.historical, createdAt: at(date, ri(16, 20)),
    }
    productionEntries.push(e)
    return e
  }

  // Historical production (last 6 months, before opening date)
  for (let age = 180; age > RECENT + 2; age -= ri(2, 4)) {
    const bom = pick(activeBoms)
    const date = workday(ago(age))
    const planned = pick(TYPICAL_BATCH[bom.productId])
    const order = makeProdOrder(date, bom, planned, pick(['Medium', 'High', 'Low']), 'Completed', true)
    makeIssue(order, date)
    makeEntry(order, clampToday(addDays(date, ri(2, 4))), planned)
  }

  // Recent completed orders
  ;[
    [40, 'fg-1001', 800], [36, 'fg-1010', 2500], [33, 'fg-1003', 1000], [29, 'fg-1007', 1500], [25, 'fg-1005', 400],
    [21, 'fg-1008', 250], [17, 'fg-1010', 2000], [13, 'fg-1001', 500], [10, 'fg-1003', 600],
  ].forEach(([age, pid, planned]) => {
    const date = workday(ago(age))
    const order = makeProdOrder(date, bomByProduct[pid], planned, pick(['Medium', 'High']), 'Completed')
    makeIssue(order, date)
    const first = Math.round(planned * 0.55)
    makeEntry(order, addDays(date, 2), first)
    makeEntry(order, addDays(date, 4), planned - first)
  })

  // In progress orders with today's production (2,450 units)
  ;[
    [5, 'fg-1010', 3000, 1000, 1200, 'High'],
    [4, 'fg-1007', 1500, 500, 650, 'Medium'],
    [3, 'fg-1003', 1000, 0, 400, 'High'],
    [6, 'fg-1001', 600, 150, 200, 'Urgent'],
  ].forEach(([age, pid, planned, earlier, todayQty, priority]) => {
    const date = ago(age)
    const order = makeProdOrder(date, bomByProduct[pid], planned, priority, 'In Progress')
    makeIssue(order, date, pid === 'fg-1010' ? 0.8 : 1)
    if (earlier) makeEntry(order, ago(Math.max(1, age - 2)), earlier)
    makeEntry(order, TODAY, todayQty)
  })

  makeProdOrder(ago(1), bomByProduct['fg-1005'], 500, 'Medium', 'Released')
  makeProdOrder(TODAY, bomByProduct['fg-1008'], 300, 'High', 'Planned')
  makeProdOrder(TODAY, bomByProduct['fg-1001'], 1000, 'Medium', 'Planned')
  const cancelled = makeProdOrder(ago(15), bomByProduct['fg-1007'], 800, 'Low', 'Cancelled')
  cancelled.remarks = 'Merged with larger batch'

  // Wastage & rejection
  const WASTE = [
    ['Rejection', 'product', 'Key not turning smoothly – lever misalignment'],
    ['Rejection', 'product', 'Plating peel-off after buffing'],
    ['Damage', 'product', 'Dent during handling on shop floor'],
    ['Wastage', 'rm-3009', 'Sheet cutting offcuts'],
    ['Scrap', 'rm-3007', 'Brass turning chips'],
    ['Wastage', 'rm-3010', 'Die-casting runners and flash'],
    ['Rejection', 'product', 'Shackle hardness below specification'],
    ['Damage', 'product', 'Scratches on satin finish during packing'],
    ['Scrap', 'rm-3008', 'Press-shop blanking scrap'],
    ['Rejection', 'product', 'Spring missing in lock assembly'],
    ['Wastage', 'pk-4001', 'Cartons torn during folding'],
  ]
  const wastageOrders = productionOrders.filter((o) => !o.historical && ['Completed', 'In Progress'].includes(o.status))
  WASTE.forEach(([type, what, reason], i) => {
    const order = wastageOrders[i % wastageOrders.length]
    const itemId = what === 'product' ? order.productId : what
    const unit = itemById[itemId].unit
    const qty = unit === 'KG' ? round2(ri(20, 180) / 10) : what === 'product' ? ri(3, 18) : ri(20, 60)
    const date = clampToday(addDays(order.date, ri(2, 4)))
    wastages.push({
      id: `wst-${i + 1}`, number: '', date, productionOrderId: order.id, itemId, qty, type, reason,
      remarks: type === 'Scrap' ? 'Sold to scrap dealer monthly' : '', warehouseId: 'wh-scr', createdAt: at(date),
    })
  })

  /* ---------------- Job workers ---------------- */
  JOB_WORKERS.forEach(([name, legal, contact, address, city, st, terms, processes]) => {
    const n = suppliers.length + 1
    const sup = {
      id: `sup-${pad(n)}`, code: `SUP-${String(n).padStart(4, '0')}`, name, companyName: legal, contactPerson: contact,
      mobile: mobile(), email: emailFor(name), gstin: gstinFor(st, name, legal.includes('Pvt') ? 'C' : 'F'),
      address, city, state: st, pincode: PINCODES[city] || '', paymentTerms: terms, openingBalance: 0, status: 'Active',
      itemIds: [], jobWorker: true, processes, createdAt: at(ago(ri(250, 400))),
    }
    suppliers.push(sup)
    supById[sup.id] = sup
  })
  const jobWorker = (name) => suppliers.find((x) => x.name === name)

  /* ---------------- Process routes ---------------- */
  const routings = Object.entries(ROUTES).map(([productId, ops], i) => ({
    id: `rt-${i + 1}`, code: `RT-${itemById[productId].code.replace(/-/g, '')}`, productId, bomId: bomByProduct[productId]?.id || null, status: 'Active',
    operations: ops.map(([stage, workCentre, mode, process, outputPerHour, ratePerPc], j) => ({
      id: `op-${i + 1}-${j + 1}`, stage, workCentre, mode, process, outputPerHour, ratePerPc, qcRequired: stage === 'Final QC',
    })),
    remarks: 'Approved by production head', createdAt: at(ago(ri(100, 200))),
  }))
  const routingByProduct = Object.fromEntries(routings.map((r) => [r.productId, r]))

  /* ---------------- Stage-wise output (WIP) ---------------- */
  const stageEntries = []
  const splitInt = (total, parts) => {
    const w = Array.from({ length: parts }, () => rand() + 0.2)
    const sw = w.reduce((a, x) => a + x, 0)
    const out = w.map((x) => Math.floor((total * x) / sw))
    out[out.length - 1] += total - out.reduce((a, x) => a + x, 0)
    return out
  }
  productionOrders
    .filter((o) => !o.historical && ['Completed', 'In Progress', 'Released'].includes(o.status) && routingByProduct[o.productId])
    .forEach((o) => {
      const ops = routingByProduct[o.productId].operations
      const n = ops.length
      const entries = productionEntries.filter((e) => e.productionOrderId === o.id)
      const produced = entries.reduce((a, e) => a + e.producedQty, 0)
      const good = produced - entries.reduce((a, e) => a + e.rejectedQty, 0)
      // Rejects happen at casting, machining, buffing, plating and final QC
      const rejectStages = ops.map((op, i) => (['Die Casting', 'Machining', 'Buffing & Polishing', 'Plating', 'Final QC'].includes(op.stage) ? i : -1)).filter((i) => i >= 0)
      const rejects = Array(n).fill(0)
      for (let k = 0; k < produced - good; k++) rejects[pick(rejectStages)]++
      // WIP still sitting at each stage (the unproduced balance spread along the line)
      const remaining = Math.max(0, o.plannedQty - produced)
      const wipW = o.status === 'Released' ? ops.map((_, i) => (i === 0 ? 0.75 : i === 1 ? 0.25 : 0)) : ops.map((_, i) => (i === 0 ? 0.08 : 0.2 + rand() * 0.4))
      const wsum = wipW.reduce((a, x) => a + x, 0) || 1
      const waiting = wipW.map((w) => Math.floor((remaining * w) / wsum))
      waiting[0] += remaining - waiting.reduce((a, x) => a + x, 0)
      // Walk backwards: ok(last) = good, input(i) = ok + rejected + waiting, ok(i-1) = input(i)
      const ok = Array(n).fill(0)
      ok[n - 1] = good
      for (let i = n - 1; i > 0; i--) ok[i - 1] = ok[i] + rejects[i] + waiting[i]
      const span = Math.max(1, Math.min(o.status === 'Completed' ? 4 : 6, Math.round((Date.parse(TODAY) - Date.parse(o.date)) / 86400000)))
      ops.forEach((op, i) => {
        if (ok[i] + rejects[i] <= 0) return
        const parts = ok[i] > 400 ? 2 : 1
        const oks = splitInt(ok[i], parts)
        const rjs = splitInt(rejects[i], parts)
        for (let k = 0; k < parts; k++) {
          const dayOffset = Math.min(Math.round(((i + k * 0.6 + 0.5) / (n + 0.5)) * span), span)
          const date = clampToday(addDays(o.date, dayOffset))
          const jw = op.mode === 'Job Work'
          stageEntries.push({
            id: `se-${stageEntries.length + 1}`, number: '', date, productionOrderId: o.id, productId: o.productId, stage: op.stage, operationId: op.id,
            workCentre: jw ? '' : op.workCentre, mode: op.mode, okQty: oks[k], rejectedQty: rjs[k],
            reworkQty: op.stage === 'Buffing & Polishing' && chance(0.4) ? ri(4, 15) : 0,
            operator: jw ? '' : pick(OPERATORS), shift: pick(['Day', 'Day', 'Night']),
            remarks: jw ? `Received back after ${op.process.toLowerCase()}` : rjs[k] ? 'Rejected pieces sent to scrap yard' : '',
            createdAt: at(date, ri(12, 19)),
          })
        }
      })
    })

  /* ---------------- Job work challans & receipts ---------------- */
  const jobWorkOrders = []
  const jobWorkReceipts = []
  const orderFor = (pid, status) => productionOrders.filter((o) => !o.historical && o.productId === pid && o.status === status).sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  ;[
    // [age, job worker, process, linked order, lines [[itemId, qty, rate]], receipts [[age, [[ok, rej] per line]]], lead days]
    [22, 'Aligarh Electroplaters', 'Nickel Plating', orderFor('fg-1001', 'Completed'), [['sf-5001', 500, 6]], [[18, [[494, 6]]]], 5],
    [16, 'Krishna Buffing Works', 'Buffing & Polishing', null, [['rm-3012', 400, 3.5]], [[13, [[400, 0]]]], 4],
    [12, 'Precision Heat Treaters', 'Heat Treatment', null, [['rm-3002', 1000, 2.2]], [[8, [[985, 15]]]], 5],
    [10, 'Aligarh Electroplaters', 'Chrome Plating', null, [['rm-3012', 300, 5.5]], [], 6],
    [6, 'Aligarh Electroplaters', 'Nickel Plating', orderFor('fg-1001', 'In Progress'), [['sf-5001', 600, 6]], [[2, [[350, 4]]]], 5],
    [4, 'Aligarh Electroplaters', 'Antique Finish', null, [['sf-5002', 250, 9], ['rm-3012', 150, 9]], [], 6],
  ].forEach(([age, workerName, process, order, lines, rcpts, lead]) => {
    const worker = jobWorker(workerName)
    const date = workday(ago(age))
    const jwo = {
      id: `jwo-${jobWorkOrders.length + 1}`, number: '', date, supplierId: worker.id, process, productionOrderId: order?.id || null,
      fromWarehouseId: 'wh-rms', returnWarehouseId: 'wh-rms', expectedDate: addDays(date, lead),
      lines: lines.map(([itemId, qty, rate]) => ({ id: lid(), itemId, qty, rate })),
      vehicleNo: `UP81 ${pick(['AT', 'CT', 'BK'])} ${ri(1000, 9999)}`, remarks: order ? 'Against production order' : pick(['Stock replenishment', 'For festive season orders']),
      status: 'Sent', createdAt: at(date),
    }
    jobWorkOrders.push(jwo)
    rcpts.forEach(([rAge, qtys]) => {
      const rDate = clampToday(workday(ago(rAge)))
      jobWorkReceipts.push({
        id: `jwr-${jobWorkReceipts.length + 1}`, number: '', date: rDate, jobWorkOrderId: jwo.id, supplierId: worker.id, returnWarehouseId: 'wh-rms',
        challanNo: `${worker.name.split(' ').map((w) => w[0]).join('')}/JW/${ri(100, 999)}`,
        lines: lines.map(([itemId, , rate], i) => ({ id: lid(), itemId, receivedQty: qtys[i][0], rejectedQty: qtys[i][1], rate })),
        remarks: qtys.some((q) => q[1]) ? 'Rejected pieces kept aside – debit for re-plating' : 'Received in good condition',
        createdAt: at(rDate),
      })
    })
  })

  /* ---------------- QC inspections ---------------- */
  const qcInspections = []
  const OBS = {
    'Key operation (10 cycles)': 'Smooth on all samples', 'Latch / bolt throw': '16–17 mm', 'Keys per lock & key differs': '3 keys, all unique', 'Plating thickness': '9.2 µm avg',
    'Salt spray test (sample)': 'No red rust at 48 h', 'Finish & appearance': 'OK', 'Length & hole centres': 'Within ±0.3 mm', 'Plating adhesion (tape test)': 'No peel-off',
    'Finish & shade': 'Matches master sample', 'Screw hole threads': 'Go / No-go OK', 'Load test (sample)': 'No deformation', 'Test certificate': 'Received, grade OK',
    Dimensions: 'Within tolerance', 'Hardness / grade': 'As per spec', 'Surface defects': 'None observed', 'Print & colour': 'OK', 'Carton strength': '13.5 kg/cm²',
    'Plating / finish thickness': '8.6 µm avg', 'Adhesion (bend / tape test)': 'OK', 'Colour / shade': 'Matches sample', 'First-piece approval': 'Approved',
    'Critical dimensions': 'Within tolerance', 'Surface finish': 'OK',
  }
  const FAIL = {
    'Raw Material': ['Surface defects', 'Blow holes / cracks on rejected pieces'],
    Packaging: ['Print & colour', 'Shade variation on rejected pieces'],
    Lock: ['Key operation (10 cycles)', 'Tight on few pieces – lever misalignment'],
    Handle: ['Plating adhesion (tape test)', 'Peel-off on few pieces'],
    'Job Work': ['Surface defects', 'Burn marks / patches on rejected pieces'],
    'In-process': ['Surface finish', 'Flash on few castings – sent for fettling'],
  }
  const addQc = ({ date, type, planKey, refCollection, refId, itemId, supplierId = null, productionOrderId = null, stage = '', lotQty, rejectedQty = 0, reworkQty = 0, inspector }) => {
    const checks = qcChecklist(planKey).map((c) => ({ ...c, observed: OBS[c.parameter] || 'OK' }))
    if (rejectedQty > 0 || reworkQty > 0) {
      const [param, text] = FAIL[planKey] || []
      const c = checks.find((x) => x.parameter === param)
      if (c) Object.assign(c, { observed: text, result: 'Fail' })
    }
    const acceptedQty = lotQty - rejectedQty - reworkQty
    const result = rejectedQty / (lotQty || 1) > 0.05 ? 'Rejected' : reworkQty > 0 ? 'Rework' : rejectedQty > 0 ? 'Accepted with Deviation' : 'Accepted'
    qcInspections.push({
      id: `qc-${qcInspections.length + 1}`, number: '', date, type, planKey, refCollection, refId, itemId, supplierId, productionOrderId, stage,
      lotQty, sampleQty: sampleSize(lotQty), checks, acceptedQty, rejectedQty, reworkQty, result, inspector,
      remarks: result === 'Accepted' ? 'Lot released' : result === 'Rejected' ? 'Lot on hold – return to supplier' : result === 'Rework' ? 'Defective pieces sent back for rework' : 'Released after segregating defective pieces',
      createdAt: at(date, ri(11, 18)),
    })
  }
  // Incoming – GRNs from the last month, except the last three days (left pending for the demo)
  grns.filter((g) => !g.historical && g.date >= ago(30) && g.date < ago(3)).forEach((g) =>
    g.lines.filter((l) => l.receivedQty > 0).forEach((l) =>
      addQc({ date: g.date, type: 'Incoming', planKey: qcPlanKey(itemById[l.itemId], 'Incoming'), refCollection: 'grns', refId: g.id, itemId: l.itemId, supplierId: g.supplierId, lotQty: l.receivedQty, rejectedQty: l.rejectedQty, inspector: g.qcBy }),
    ),
  )
  // Job work returns – all but the latest receipt
  jobWorkReceipts.filter((r) => r.date < ago(2)).forEach((r) =>
    r.lines.forEach((l) =>
      addQc({ date: r.date, type: 'Job Work', planKey: 'Job Work', refCollection: 'jobWorkReceipts', refId: r.id, itemId: l.itemId, supplierId: r.supplierId, lotQty: l.receivedQty + l.rejectedQty, rejectedQty: l.rejectedQty, inspector: 'Deepak Chauhan' }),
    ),
  )
  // Final – recent completed orders except the latest one
  const completedRecent = productionOrders.filter((o) => !o.historical && o.status === 'Completed').sort((a, b) => (a.date < b.date ? -1 : 1))
  completedRecent.slice(0, -1).forEach((o) => {
    const es = productionEntries.filter((e) => e.productionOrderId === o.id)
    const produced = es.reduce((a, e) => a + e.producedQty, 0)
    const rejected = es.reduce((a, e) => a + e.rejectedQty, 0)
    const date = es.reduce((a, e) => (e.date > a ? e.date : a), o.date)
    addQc({ date, type: 'Final', planKey: qcPlanKey(itemById[o.productId], 'Final'), refCollection: 'productionOrders', refId: o.id, itemId: o.productId, productionOrderId: o.id, stage: 'Final QC', lotQty: produced, rejectedQty: Math.min(rejected, Math.round(produced * 0.02)), inspector: 'Deepak Chauhan' })
  })
  // In-process patrol checks on running orders
  productionOrders.filter((o) => !o.historical && o.status === 'In Progress').forEach((o, i) => {
    const op = routingByProduct[o.productId]?.operations[0]
    if (!op) return
    addQc({ date: clampToday(addDays(o.date, 1)), type: 'In-process', planKey: 'In-process', refCollection: 'productionOrders', refId: o.id, itemId: o.productId, productionOrderId: o.id, stage: op.stage, lotQty: 50, reworkQty: i === 1 ? 4 : 0, inspector: pick(['Deepak Chauhan', 'Mohd. Irfan']) })
  })

  /* ---------------- Inventory documents ---------------- */
  const stockTransfers = [
    [34, 'wh-fgg', 'wh-del', [['fg-1001', 120], ['fg-1003', 200], ['fg-1010', 400]], 'Received'],
    [21, 'wh-fgg', 'wh-del', [['fg-1007', 250], ['fg-1011', 300], ['tr-2001', 80]], 'Received'],
    [12, 'wh-del', 'wh-fgg', [['fg-1003', 40]], 'Received'],
    [9, 'wh-fgg', 'wh-del', [['fg-1005', 60], ['fg-1009', 90]], 'Received'],
    [1, 'wh-fgg', 'wh-del', [['fg-1001', 80], ['fg-1010', 250]], 'In Transit'],
  ].map(([age, from, to, lines, status], i) => {
    const date = workday(ago(age))
    return {
      id: `str-${i + 1}`, number: '', date, fromWarehouseId: from, toWarehouseId: to,
      lines: lines.map(([itemId, qty]) => ({ id: lid(), itemId, qty })),
      vehicleNo: `UP81 ${pick(['AT', 'CT'])} ${ri(1000, 9999)}`, status,
      remarks: to === 'wh-del' ? 'Replenishment for Delhi Depot' : 'Slow-moving stock returned to godown', createdAt: at(date),
    }
  })

  const stockIns = [
    [40, 'wh-rms', 'rm-3012', 120, 'JW/SEP/118', 'Job work return – plating (Surya Electroplating)'],
    [27, 'wh-fgg', 'tr-2001', 40, 'FOC/AHW/22', 'Free replacement from Aligarh Hardware Works'],
    [15, 'wh-rms', 'rm-3004', 2000, 'PV/2026/07', 'Found during physical verification'],
    [8, 'wh-fgg', 'tr-2004', 2, 'SMP/SM/004', 'Demo units received from SecureMax'],
    [3, 'wh-rms', 'pk-4003', 60, 'RTN/PKG/011', 'Unused master cartons returned from dispatch'],
  ].map(([age, wh, itemId, qty, reference, remarks], i) => {
    const date = workday(ago(age))
    return { id: `sin-${i + 1}`, number: '', date, warehouseId: wh, itemId, qty, reference, remarks, createdAt: at(date) }
  })

  const stockOuts = [
    [38, 'wh-fgg', 'fg-1013', 6, 'SMP/ROYAL/BLR', 'Samples to Royal Interiors, Bengaluru'],
    [26, 'wh-fgg', 'fg-1002', 12, 'EXPO/PM/26', 'Display stock for Hardware Expo, Pragati Maidan'],
    [14, 'wh-rms', 'rm-3013', 4, 'MNT/PLT/09', 'Issued for plating tank maintenance'],
    [6, 'wh-rms', 'rm-3012', 150, 'JW/OCT/121', 'Sent for nickel plating job work'],
    [2, 'wh-del', 'fg-1010', 20, 'SMP/DEL/33', 'Counter samples for Delhi dealers'],
  ].map(([age, wh, itemId, qty, reference, remarks], i) => {
    const date = workday(ago(age))
    return { id: `sout-${i + 1}`, number: '', date, warehouseId: wh, itemId, qty, reference, remarks, createdAt: at(date) }
  })

  const stockAdjustments = [
    [38, 'wh-rms', 'rm-3004', -350, 'Physical verification variance'],
    [24, 'wh-fgg', 'fg-1011', 4, 'Counting error corrected'],
    [16, 'wh-fgg', 'fg-1009', -8, 'Damaged units written off'],
    [7, 'wh-rms', 'rm-3007', -3.5, 'Weighing scale calibration difference'],
    [1, 'wh-fgg', 'tr-2005', 6, 'Unit conversion correction (BOX)'],
  ].map(([age, wh, itemId, diff, reason], i) => {
    const date = workday(ago(age))
    return {
      id: `adj-${i + 1}`, number: '', date, warehouseId: wh, itemId, systemQty: 0, actualQty: 0, difference: diff, reason,
      remarks: 'Verified by store in-charge', approvedBy: 'Rajesh Kumar', createdAt: at(date),
    }
  })

  /* ---------------- Users, settings ---------------- */
  const users = USERS.map(([id, name, email, mob, role, department, status], i) => ({
    id, name, email, mobile: mob, role, department, status, password: 'demo123',
    lastLogin: status === 'Active' ? at(ago(i < 4 ? 0 : ri(0, 6))) : at(ago(70)), createdAt: at(ago(400 - i * 12)),
  }))
  const roles = Object.keys(ROLE_PERMS).map((name, i) => ({ id: `role-${i + 1}`, name, description: ROLE_DESC[name], permissions: buildPermissions(name), system: i < 2 }))

  const DEVICES = ['Chrome on Windows 11', 'Edge on Windows 10', 'Safari on iPhone', 'Chrome on Android', 'Chrome on macOS']
  const loginActivity = []
  users.filter((u) => u.status === 'Active').forEach((u) => {
    for (let k = 0; k < 6; k++) {
      const d = ago(k * ri(1, 3))
      loginActivity.push({
        id: `log-${loginActivity.length + 1}`, userId: u.id, at: at(d, ri(9, 11)), device: pick(DEVICES),
        ip: `49.36.${ri(10, 250)}.${ri(2, 250)}`, location: pick(['Aligarh, Uttar Pradesh', 'Aligarh, Uttar Pradesh', 'New Delhi, Delhi', 'Noida, Uttar Pradesh']),
        status: k === 3 && chance(0.4) ? 'Failed' : 'Success',
      })
    }
  })

  const settings = {
    company: {
      name: 'NexttGen ERP Demo Company',
      legalName: 'NexttGen Technologies Pvt. Ltd.',
      logo: null,
      address: 'Plot No. 42, Talanagri Industrial Estate, Ramghat Road',
      city: 'Aligarh',
      state: 'Uttar Pradesh',
      pincode: '202001',
      phone: '+91 571 240 1142',
      mobile: '+91 98971 20045',
      email: 'accounts@nexttgen.com',
      website: 'www.nexttgen.com',
      gstin: '09AAHCN7312E1Z5',
      pan: 'AAHCN7312E',
      cin: 'U28999UP2019PTC118452',
      msme: 'UDYAM-UP-02-0048213',
      invoicePrefix: 'NGT/INV',
      bankName: 'HDFC Bank',
      bankAccount: '50200012344821',
      ifsc: 'HDFC0000452',
      bankBranch: 'Marris Road, Aligarh',
      financialYear: '2026-27',
    },
    tax: { cgst: 9, sgst: 9, igst: 18, defaultGst: 18, gstRates: [0, 5, 12, 18, 28], hsnDigits: 8, showHsnOnInvoice: true, hsnMandatory: true, reverseCharge: false, roundOff: true, compositionScheme: false },
    invoice: {
      series: 'FY 2026-27',
      prefix: 'NGT/INV',
      numberFormat: '{PREFIX}/{FY}/{SEQ4}',
      terms: '1. Goods once sold will not be taken back or exchanged.\n2. Interest @ 18% p.a. will be charged if payment is not made within the due date.\n3. Our responsibility ceases once goods leave our premises.\n4. Subject to Aligarh jurisdiction only. E. & O.E.',
      footer: 'This is a computer generated invoice.',
      showBankDetails: true,
      showSignature: true,
      showAmountInWords: true,
      copies: ['Original for Recipient', 'Duplicate for Transporter', 'Triplicate for Supplier'],
    },
    paymentTerms: [
      { id: 'pt-1', name: 'Cash', days: 0, description: 'Payment on delivery', status: 'Active' },
      { id: 'pt-2', name: '15 Days', days: 15, description: 'Net 15 days from invoice date', status: 'Active' },
      { id: 'pt-3', name: '30 Days', days: 30, description: 'Net 30 days from invoice date', status: 'Active' },
      { id: 'pt-4', name: '45 Days', days: 45, description: 'Net 45 days from invoice date', status: 'Active' },
      { id: 'pt-5', name: '60 Days', days: 60, description: 'Net 60 days – key distributors only', status: 'Active' },
      { id: 'pt-6', name: 'Advance', days: 0, description: '100% advance before dispatch', status: 'Inactive' },
    ],
    accounts: [
      { id: 'acc-cash', name: 'Cash in Hand', type: 'Cash', number: '', openingBalance: 185000 },
      { id: 'acc-hdfc', name: 'HDFC Bank – Current A/c', type: 'Bank', number: 'XXXX4821', openingBalance: 2450000 },
      { id: 'acc-icici', name: 'ICICI Bank – Cash Credit A/c', type: 'Bank', number: 'XXXX0937', openingBalance: 850000 },
    ],
    companies: [
      { id: 'cmp-1', name: 'NexttGen Technologies Pvt. Ltd.', location: 'Aligarh Plant' },
      { id: 'cmp-2', name: 'NexttGen Trading Division', location: 'Delhi Depot' },
    ],
    activeCompanyId: 'cmp-1',
    preferences: { emailAlerts: true, lowStockAlerts: true, paymentReminders: true, productionAlerts: true, dailySummary: false },
  }

  /* ---------------- Assign document numbers (chronological) ---------------- */
  /* ---------------- HR: employees, holidays, leave, attendance, payroll ---------------- */
  // Separate generator so HR data never shifts the rest of the demo dataset.
  const hrRand = mulberry32(260814)
  const hri = (a, b) => Math.floor(hrRand() * (b - a + 1)) + a
  const hrChance = (p) => hrRand() < p
  const hrPick = (arr) => arr[Math.floor(hrRand() * arr.length)]
  const hrYear = Number(TODAY.slice(0, 4))
  const BANKS = [['HDFC Bank', 'HDFC0001234'], ['State Bank of India', 'SBIN0000613'], ['Punjab National Bank', 'PUNB0123400'], ['ICICI Bank', 'ICIC0000471']]
  const LOCALITIES = ['Sarai Sultani', 'Ramghat Road', 'Jamalpur', 'Dodhpur', 'Quarsi', 'Sasni Gate', 'Talanagri', 'Mahendra Nagar']

  const holidays = [hrYear - 1, hrYear].flatMap((y) =>
    HOLIDAYS.map(([md, name, type]) => ({ id: `hol-${y}-${md}`, name, date: `${y}-${md}`, type, description: '', status: 'Active', createdAt: at(`${y - 1}-12-20`) })),
  )
  const holidaySet = new Set(holidays.map((h) => h.date))
  const leaveTypes = LEAVE_TYPES.map((t) => ({ ...t, status: 'Active', createdAt: at(`${hrYear - 1}-12-20`) }))

  const employees = EMPLOYEES.map(([id, name, gender, department, designation, employmentType, joinedAgo, shift, weeklyOff, salaryType, amount, userId, pf, esi, paymentMode, fatherName], i) => {
    const n = i + 1
    const [bankName, ifsc] = BANKS[i % BANKS.length]
    const monthly = salaryType === 'Monthly'
    const basic = monthly ? Math.round((amount * 0.5) / 100) * 100 : 0
    const hra = monthly ? Math.round((basic * 0.4) / 100) * 100 : 0
    const conveyance = monthly ? 1600 : 0
    const cash = paymentMode === 'Cash'
    const joiningDate = addDays(TODAY, -joinedAgo)
    return {
      id, code: `EMP-${String(n).padStart(4, '0')}`, name, fatherName, gender,
      dob: addDays(TODAY, -(365 * hri(22, 48) + hri(0, 364))),
      mobile: `+91 9${hri(1000, 9999)} ${hri(10000, 99999)}`,
      email: userId ? USERS.find((u) => u[0] === userId)[2] : '',
      address: `${hrPick(LOCALITIES)}, Aligarh, Uttar Pradesh 2020${hri(0, 2)}${hri(1, 9)}`,
      department, designation, employmentType, joiningDate, exitDate: '', shift, weeklyOff, userId,
      salaryType, basic, hra, conveyance, specialAllowance: monthly ? amount - basic - hra - conveyance : 0, dailyRate: monthly ? 0 : amount,
      pfApplicable: pf, esiApplicable: esi,
      uan: pf ? `10${hri(10000000, 99999999)}${hri(10, 99)}` : '',
      esicNo: esi ? `69${hri(10000000, 99999999)}` : '',
      pan: monthly && amount > 20000 ? `${'ABCDEFGHJK'[n % 10]}${'PQRSTUVWXY'[(n * 3) % 10]}${'LMNPQ'[n % 5]}P${name[0].toUpperCase()}${hri(1000, 9999)}${'ABCDEFGHJK'[(n * 7) % 10]}` : '',
      paymentMode, bankName: cash ? '' : bankName, bankAccount: cash ? '' : `${hri(1000, 9999)}${hri(10000000, 99999999)}`, ifsc: cash ? '' : ifsc,
      status: 'Active', createdAt: at(joiningDate),
    }
  })
  const hrBase = { employees, holidays, leaveTypes, attendance: [], leaveApplications: [] }
  const isOff = (emp, d) => holidaySet.has(d) || isWeeklyOff(emp, d)
  const nextWorkday = (emp, d) => {
    let x = d
    while (isOff(emp, x)) x = addDays(x, 1)
    return x
  }
  const approverOf = (emp) => (emp.id === 'emp-01' ? 'Vikram Malhotra' : emp.department === 'Production' && emp.id !== 'emp-08' ? 'Mohd. Irfan' : 'Rajesh Kumar')

  // Leave applications — history over the last three months plus a few upcoming requests
  const HR_START = `${shiftMonth(TODAY.slice(0, 7), -3)}-01`
  const LEAVE_REASONS = {
    'lt-cl': ['Family function', 'Personal work at the bank', 'Parent-teacher meeting', 'Going to the village'],
    'lt-sl': ['Fever', 'Viral infection', 'Back pain', 'Stomach infection'],
    'lt-el': ['Sister’s wedding', 'Family trip to Haridwar', 'House shifting'],
    'lt-lwp': ['Personal work, paid leave used up', 'Extended stay in the village'],
  }
  const leaveApplications = []
  const leaveDates = new Map()
  const addLeave = (emp, leaveTypeId, from, len, status, halfDay = false) => {
    let to = from
    if (!halfDay) {
      let n = 0
      for (;;) {
        if (!isOff(emp, to)) n += 1
        if (n >= len) break
        to = addDays(to, 1)
      }
    }
    const taken = leaveDates.get(emp.id) || new Set()
    let clash = from < emp.joiningDate
    eachDate(from, to, (d) => (clash = clash || taken.has(d)))
    if (clash) return
    eachDate(from, to, (d) => taken.add(d))
    leaveDates.set(emp.id, taken)
    const date = status === 'Pending' ? addDays(TODAY, -hri(0, 1)) : clampToday(addDays(from, leaveTypeId === 'lt-sl' ? 0 : -hri(1, 8)))
    const decided = status === 'Approved' || status === 'Rejected'
    leaveApplications.push({
      id: `lv-${leaveApplications.length + 1}`, number: '', date, employeeId: emp.id, leaveTypeId, from, to, halfDay,
      days: leaveDaysCount(hrBase, emp, from, to, halfDay), reason: hrPick(LEAVE_REASONS[leaveTypeId]), status,
      actionBy: decided ? approverOf(emp) : '', actionAt: decided ? at(clampToday(addDays(date, hri(0, 1))), 17) : '',
      actionRemarks: status === 'Rejected' ? 'Dispatch schedule is tight that week. Please take it later.' : '',
      createdAt: at(date, hri(9, 11)),
    })
  }
  employees.forEach((emp) => {
    const count = hri(0, 3)
    for (let k = 0; k < count; k++) {
      const roll = hrRand()
      const lt = roll < 0.5 ? 'lt-cl' : roll < 0.8 ? 'lt-sl' : roll < 0.9 ? 'lt-el' : 'lt-lwp'
      const len = lt === 'lt-cl' ? hri(1, 2) : lt === 'lt-sl' ? hri(1, 3) : lt === 'lt-el' ? hri(3, 5) : hri(1, 2)
      const from = nextWorkday(emp, addDays(HR_START, hri(0, daysBetween(HR_START, TODAY) - 2)))
      if (from >= TODAY) continue
      const half = ['lt-cl', 'lt-sl'].includes(lt) && len === 1 && hrChance(0.25)
      addLeave(emp, lt, from, len, hrChance(0.9) ? 'Approved' : 'Rejected', half)
    }
  })
  const empById = new Map(employees.map((e) => [e.id, e]))
  ;[['emp-18', 'lt-sl', 0, 1, 'Pending'], ['emp-13', 'lt-cl', 3, 2, 'Pending'], ['emp-16', 'lt-cl', 1, 1, 'Pending'], ['emp-04', 'lt-el', 12, 4, 'Pending'], ['emp-02', 'lt-el', 20, 5, 'Approved']].forEach(
    ([id, lt, offset, len, status]) => {
      const emp = empById.get(id)
      addLeave(emp, lt, nextWorkday(emp, addDays(TODAY, offset)), len, status)
    },
  )
  const approvedDay = new Map()
  leaveApplications
    .filter((l) => l.status === 'Approved')
    .forEach((l) => eachDate(l.from, l.to, (d) => approvedDay.set(`${l.employeeId}|${d}`, l)))

  // Daily attendance sheets from the start of the range up to today
  const SHIFT_MINS = { General: [570, 1080], Morning: [360, 840], Evening: [840, 1320] }
  const hm = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`
  const floorStaff = (e) => ['Production', 'Packaging', 'Maintenance'].includes(e.department)
  const notMarkedToday = new Set(['emp-18', 'emp-21', 'emp-23'])
  const attendance = []
  eachDate(HR_START, TODAY, (date) => {
    const entries = {}
    employees.forEach((emp) => {
      if (date < emp.joiningDate) return
      if (date === TODAY && (notMarkedToday.has(emp.id) || emp.shift === 'Evening')) return
      const lv = approvedDay.get(`${emp.id}|${date}`)
      if (lv && !lv.halfDay) return
      const [start, end] = SHIFT_MINS[emp.shift]
      if (isOff(emp, date)) {
        if (floorStaff(emp) && !holidaySet.has(date) && date !== TODAY && hrChance(0.04)) entries[emp.id] = { status: 'P', in: hm(start - hri(0, 10)), out: hm(end - 120), ot: 0, remarks: 'Called in for urgent dispatch' }
        return
      }
      if (lv?.halfDay) {
        entries[emp.id] = { status: 'HD', in: hm(start + 270 + hri(0, 10)), out: date === TODAY ? '' : hm(end + hri(0, 10)), ot: 0, remarks: 'Half-day leave in first half' }
        return
      }
      const roll = hrRand()
      if (roll < 0.025) {
        entries[emp.id] = { status: 'A', remarks: hrChance(0.5) ? 'Not informed' : '' }
        return
      }
      if (roll < 0.035) {
        entries[emp.id] = { status: 'L', leaveTypeId: 'lt-sl', remarks: 'Informed on phone' }
        return
      }
      const late = hrChance(0.08)
      const inMin = late ? start + hri(12, 45) : start - hri(0, 15) + hri(0, 8)
      if (roll < 0.06) {
        entries[emp.id] = { status: 'HD', in: hm(inMin), out: hm(start + 270), ot: 0, remarks: 'Left after first half' }
        return
      }
      if (date === TODAY) {
        entries[emp.id] = { status: 'P', in: hm(inMin), out: '', ot: 0 }
        return
      }
      const ot = floorStaff(emp) && emp.shift !== 'Evening' && hrChance(0.12) ? hri(1, 3) : 0
      entries[emp.id] = { status: 'P', in: hm(inMin), out: hm(end + ot * 60 + hri(-5, 15)), ot }
    })
    if (Object.keys(entries).length) attendance.push({ id: `att-${date}`, date, name: date, entries, markedBy: 'Kavita Singh', createdAt: at(date, 10, hri(0, 30)) })
  })

  // Salary sheets — the two months before last are paid; last month is waiting for the owner to generate
  const hrState = { employees, holidays, leaveTypes, attendance, leaveApplications }
  const PAYROLL_ADJ = { 3: [['emp-12', { advance: 2000 }]], 2: [['emp-04', { incentive: 2500 }], ['emp-23', { advance: 1000 }]] }
  const payrollRuns = [3, 2].map((back, i) => {
    const ym = shiftMonth(TODAY.slice(0, 7), -back)
    const next = shiftMonth(ym, 1)
    const run = buildPayroll(hrState, ym, (PAYROLL_ADJ[back] || []).map(([employeeId, adjustments]) => ({ employeeId, adjustments })))
    const date = clampToday(`${next}-03`)
    const bank = run.slips.filter((s) => s.paymentMode !== 'Cash').reduce((a, s) => a + s.netPay, 0)
    return {
      id: `sal-${i + 1}`, number: '', date, month: ym, status: 'Paid', slips: run.slips, totals: run.totals, remarks: '',
      generatedBy: 'Vikram Malhotra', approvedBy: 'Vikram Malhotra', approvedAt: at(date, 17),
      paidOn: clampToday(`${next}-07`), paymentRef: `NEFT batch ${ym.replace('-', '')}`,
      disbursements: [{ accountId: 'acc-hdfc', amount: bank }, { accountId: 'acc-cash', amount: run.totals.net - bank }].filter((d) => d.amount),
      createdAt: at(date, 16),
    }
  })

  const numberAll = (list, prefix) => {
    const counters = {}
    ;[...list]
      .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? -1 : 1) : a.date < b.date ? -1 : 1))
      .forEach((doc) => {
        const fy = `${prefix}|${formatDocNumber('', doc.date, 0).split('/')[1]}`
        counters[fy] = (counters[fy] || 0) + 1
        doc.number = formatDocNumber(prefix, doc.date, counters[fy] + (prefix === 'NGT/INV' ? 0 : 0))
      })
  }
  numberAll(purchaseRequisitions, 'PR')
  numberAll(purchaseOrders, 'PO')
  numberAll(grns, 'GRN')
  numberAll(purchaseInvoices, 'PB')
  numberAll(purchaseReturns, 'PRN')
  numberAll(quotations, 'QT')
  numberAll(salesOrders, 'SO')
  numberAll(deliveryChallans, 'DC')
  numberAll(salesInvoices, 'NGT/INV')
  numberAll(salesReturns, 'SRN')
  numberAll(stockIns, 'SIN')
  numberAll(stockOuts, 'SOUT')
  numberAll(stockTransfers, 'STR')
  numberAll(stockAdjustments, 'ADJ')
  numberAll(productionOrders, 'PRD')
  numberAll(materialIssues, 'MI')
  numberAll(productionEntries, 'PE')
  numberAll(wastages, 'WST')
  numberAll(stageEntries, 'SE')
  numberAll(jobWorkOrders, 'JWO')
  numberAll(jobWorkReceipts, 'JWR')
  numberAll(qcInspections, 'QC')
  numberAll(receipts, 'RCT')
  numberAll(payments, 'PAY')
  numberAll(leaveApplications, 'LV')
  numberAll(payrollRuns, 'SAL')

  let state = {
    version: DATA_VERSION,
    seededAt: new Date().toISOString(),
    categories, brands, units, warehouses, items, customers, suppliers, productFamilies,
    purchaseRequisitions, purchaseOrders, grns, purchaseInvoices, purchaseReturns,
    quotations, salesOrders, deliveryChallans, salesInvoices, salesReturns,
    stockIns, stockOuts, stockTransfers, stockAdjustments,
    boms, productionOrders, materialIssues, productionEntries, wastages,
    routings, stageEntries, jobWorkOrders, jobWorkReceipts, qcInspections,
    employees, leaveTypes, holidays, attendance, leaveApplications, payrollRuns,
    receipts, payments, users, roles, loginActivity, settings,
    notifications: [], activities: [], stockMoves: [],
  }

  /* ---------------- Opening stock so that closing ≈ target ---------------- */
  const tempMoves = rebuildAllMoves(state)
  items.forEach((item) => {
    const key = `${item.id}|${item.warehouseId}`
    const moves = tempMoves.filter((m) => `${m.itemId}|${m.warehouseId}` === key).sort((a, b) => (a.date < b.date ? -1 : 1))
    let cum = 0
    let minCum = 0
    moves.forEach((m) => {
      cum += m.qty
      minCum = Math.min(minCum, cum)
    })
    const target = TARGET[item.id] ?? 0
    const buffer = target > 0 ? Math.ceil(target * 0.05) : 0
    item.openingStock = Math.max(0, Math.ceil(Math.max(target - cum, -minCum + buffer)))
  })
  state.stockMoves = rebuildAllMoves(state)

  // Adjustment snapshot quantities
  stockAdjustments.forEach((adj) => {
    const before = state.stockMoves
      .filter((m) => m.itemId === adj.itemId && m.warehouseId === adj.warehouseId && m.date <= adj.date && m.sourceId !== adj.id)
      .reduce((a, m) => a + m.qty, 0)
    adj.systemQty = round2(before)
    adj.actualQty = round2(before + adj.difference)
  })

  state = syncStatuses(state)

  /* ---------------- Notifications & activity ---------------- */
  const balance = (itemId) => round2(state.stockMoves.filter((m) => m.itemId === itemId).reduce((a, m) => a + m.qty, 0))
  const lowItems = items.filter((i) => i.status === 'Active' && i.minStock > 0 && balance(i.id) <= i.minStock).slice(0, 3)
  const latest = (list, filter = () => true) => [...list].filter(filter).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
  const fmtInr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`
  const hoursAgo = (h) => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - Math.round(h * 60))
    return d.toISOString()
  }

  const pendingPO = latest(state.purchaseOrders, (p) => p.status === 'Submitted')
  const pendingSO = latest(state.salesOrders, (s) => ['Pending', 'Confirmed'].includes(s.status))
  const todayInv = latest(state.salesInvoices, (i) => i.date === TODAY)
  const overdue = state.salesInvoices
    .filter((i) => !i.historical && i.dueDate < TODAY && !state.receipts.some((r) => r.invoiceId === i.id))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0]
  const plannedPrd = latest(state.productionOrders, (p) => p.status === 'Planned')
  const todayGrn = latest(state.grns, (g) => g.date === TODAY)
  const newCustomer = customers[customers.length - 1]

  const notifications = []
  const pushN = (type, title, message, h, link, read = false) =>
    notifications.push({ id: `ntf-${notifications.length + 1}`, type, title, message, at: hoursAgo(h), read, link })

  lowItems.forEach((it, i) =>
    pushN('stock', `Low stock: ${it.name}`, `${balance(it.id)} ${it.unit} left against a minimum of ${it.minStock} ${it.unit}.`, 0.3 + i * 1.7, '/inventory/stock', i > 1),
  )
  if (todayInv) pushN('invoice', 'Invoice generated', `${todayInv.number} for ${custById[todayInv.customerId].name} – ${fmtInr(todayInv.totals.grandTotal)}.`, 0.8, `/sales/invoices/${todayInv.id}`)
  if (todayGrn) pushN('purchase', 'Material received', `${todayGrn.number} from ${supById[todayGrn.supplierId].name} posted to ${warehouses.find((w) => w.id === todayGrn.warehouseId).name}.`, 1.5, `/purchase/grn/${todayGrn.id}`)
  if (pendingPO) pushN('purchase', 'Purchase order awaiting approval', `${pendingPO.number} from ${supById[pendingPO.supplierId].name} for ${fmtInr(pendingPO.totals.grandTotal)}.`, 2.4, `/purchase/orders/${pendingPO.id}`)
  if (pendingSO) pushN('sales', 'Sales order pending dispatch', `${pendingSO.number} for ${custById[pendingSO.customerId].name} is due on ${pendingSO.deliveryDate}.`, 3.2, `/sales/orders/${pendingSO.id}`)
  if (overdue) pushN('payment', 'Payment overdue', `${custById[overdue.customerId].name} has not paid ${overdue.number} (${fmtInr(overdue.totals.grandTotal)}).`, 5, '/accounts/outstanding')
  if (plannedPrd) pushN('production', 'Production pending', `${plannedPrd.number} for ${plannedPrd.plannedQty} × ${itemById[plannedPrd.productId].name} is waiting for material issue.`, 6.5, `/production/orders/${plannedPrd.id}`, true)
  const overdueJw = state.jobWorkOrders.filter((j) => j.status === 'Sent' && j.expectedDate < TODAY)[0]
  if (overdueJw) pushN('production', 'Job work overdue', `${overdueJw.number} (${overdueJw.process.toLowerCase()}) with ${supById[overdueJw.supplierId].name} was due on ${overdueJw.expectedDate}.`, 1.1, `/production/job-work/${overdueJw.id}`)
  const pendingGrnQc = state.grns.filter((g) => !g.historical && g.date >= ago(3)).length
  if (pendingGrnQc) pushN('purchase', 'Incoming QC pending', `${pendingGrnQc} goods receipt(s) from the last 3 days are waiting for inspection.`, 2, '/quality')
  pushN('customer', 'New customer added', `${newCustomer.name}, ${newCustomer.city} was added by Neha Gupta.`, 26, `/masters/customers?view=${newCustomer.id}`, true)
  pushN('system', 'Daily backup completed', 'Demo data snapshot saved in this browser.', 30, '/settings/company', true)

  const activities = []
  const pushA = (user, action, entity, ref, module, h, link) =>
    activities.push({ id: `act-${activities.length + 1}`, user, action, entity, ref, module, at: hoursAgo(h), link })
  const recent = (list, n, filter = () => true) => [...list].filter(filter).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, n)
  recent(state.salesInvoices, 3, (i) => !i.historical).forEach((d, i) => pushA(pick(SALES_PERSONS), 'created', 'Sales Invoice', d.number, 'Sales', 0.5 + i * 7, `/sales/invoices/${d.id}`))
  recent(state.grns, 2).forEach((d, i) => pushA('Suresh Yadav', 'posted', 'Goods Receipt', d.number, 'Purchase', 1.2 + i * 9, `/purchase/grn/${d.id}`))
  recent(state.productionEntries, 3, (e) => !e.historical).forEach((d, i) => pushA('Mohd. Irfan', 'recorded', 'Production Entry', d.number, 'Production', 1.8 + i * 6, `/production/entries/${d.id}`))
  recent(state.receipts, 3).forEach((d, i) => pushA('Pooja Agarwal', 'received', `payment of ${fmtInr(d.amount)} against`, d.number, 'Accounts', 2.6 + i * 8, '/accounts/receipts'))
  recent(state.purchaseOrders, 2).forEach((d, i) => pushA('Amit Verma', 'created', 'Purchase Order', d.number, 'Purchase', 3.4 + i * 11, `/purchase/orders/${d.id}`))
  recent(state.salesOrders, 2).forEach((d, i) => pushA('Karan Singh', 'confirmed', 'Sales Order', d.number, 'Sales', 4.1 + i * 10, `/sales/orders/${d.id}`))
  recent(state.stockTransfers, 1).forEach((d) => pushA('Suresh Yadav', 'dispatched', 'Stock Transfer', d.number, 'Inventory', 20, `/inventory/transfers/${d.id}`))
  recent(state.qcInspections, 2).forEach((d, i) => pushA(d.inspector, 'inspected', 'QC Inspection', d.number, 'Quality', 2.2 + i * 7, `/quality/inspections/${d.id}`))
  recent(state.jobWorkOrders, 1).forEach((d) => pushA('Ramesh Pal', 'sent', 'Job Work Challan', d.number, 'Production', 6.5, `/production/job-work/${d.id}`))
  recent(state.productionOrders, 1, (p) => p.status === 'Planned').forEach((d) => pushA('Rajesh Kumar', 'planned', 'Production Order', d.number, 'Production', 5.5, `/production/orders/${d.id}`))
  pushA('Anjali Sharma', 'updated', 'Item', 'FG-1004 Laminated Steel Padlock 65mm', 'Masters', 28, '/masters/items?view=fg-1004')
  activities.sort((a, b) => (a.at < b.at ? 1 : -1))

  state.notifications = notifications.sort((a, b) => (a.at < b.at ? 1 : -1))
  state.activities = activities

  // strip generator-only helpers
  state.customers = state.customers.map(({ weight, ...c }) => c)
  return state
}
