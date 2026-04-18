/**
 * Curated list of CEDEARs listed on BYMA.
 *
 * Ratios are the number of underlying shares represented by one CEDEAR
 * (e.g., AAPL ratio 20 → 1 AAPL share = 20 CEDEARs, so 1 CEDEAR ≈ AAPL / 20).
 *
 * Ratios change with splits and BYMA adjustments. Treat this as a seed list;
 * users can override per position when adding to the portfolio.
 */
export interface CedearEntry {
  underlying: string
  name: string
  ratio: number
}

export const CEDEAR_RATIOS: Record<string, CedearEntry> = {
  'AAPL.BA':  { underlying: 'AAPL',  name: 'Apple',            ratio: 20 },
  'MSFT.BA':  { underlying: 'MSFT',  name: 'Microsoft',        ratio: 54 },
  'GOOGL.BA': { underlying: 'GOOGL', name: 'Alphabet',         ratio: 58 },
  'AMZN.BA':  { underlying: 'AMZN',  name: 'Amazon',           ratio: 48 },
  'META.BA':  { underlying: 'META',  name: 'Meta Platforms',   ratio: 36 },
  'TSLA.BA':  { underlying: 'TSLA',  name: 'Tesla',            ratio: 30 },
  'NVDA.BA':  { underlying: 'NVDA',  name: 'NVIDIA',           ratio: 10 },
  'NFLX.BA':  { underlying: 'NFLX',  name: 'Netflix',          ratio: 20 },
  'DISN.BA':  { underlying: 'DIS',   name: 'Walt Disney',      ratio: 6 },
  'KO.BA':    { underlying: 'KO',    name: 'Coca-Cola',        ratio: 7 },
  'PEP.BA':   { underlying: 'PEP',   name: 'PepsiCo',          ratio: 15 },
  'WMT.BA':   { underlying: 'WMT',   name: 'Walmart',          ratio: 12 },
  'MCD.BA':   { underlying: 'MCD',   name: "McDonald's",       ratio: 20 },
  'NKE.BA':   { underlying: 'NKE',   name: 'Nike',             ratio: 5 },
  'SBUX.BA':  { underlying: 'SBUX',  name: 'Starbucks',        ratio: 6 },
  'JPM.BA':   { underlying: 'JPM',   name: 'JPMorgan Chase',   ratio: 20 },
  'BAC.BA':   { underlying: 'BAC',   name: 'Bank of America',  ratio: 4 },
  'C.BA':     { underlying: 'C',     name: 'Citigroup',        ratio: 10 },
  'GS.BA':    { underlying: 'GS',    name: 'Goldman Sachs',    ratio: 24 },
  'V.BA':     { underlying: 'V',     name: 'Visa',             ratio: 15 },
  'MA.BA':    { underlying: 'MA',    name: 'Mastercard',       ratio: 20 },
  'PYPL.BA':  { underlying: 'PYPL',  name: 'PayPal',           ratio: 4 },
  'INTC.BA':  { underlying: 'INTC',  name: 'Intel',            ratio: 2 },
  'AMD.BA':   { underlying: 'AMD',   name: 'AMD',              ratio: 20 },
  'CSCO.BA':  { underlying: 'CSCO',  name: 'Cisco',            ratio: 5 },
  'ORCL.BA':  { underlying: 'ORCL',  name: 'Oracle',           ratio: 16 },
  'IBM.BA':   { underlying: 'IBM',   name: 'IBM',              ratio: 9 },
  'ADBE.BA':  { underlying: 'ADBE',  name: 'Adobe',            ratio: 40 },
  'CRM.BA':   { underlying: 'CRM',   name: 'Salesforce',       ratio: 20 },
  'XOM.BA':   { underlying: 'XOM',   name: 'Exxon Mobil',      ratio: 5 },
  'CVX.BA':   { underlying: 'CVX',   name: 'Chevron',          ratio: 10 },
  'PFE.BA':   { underlying: 'PFE',   name: 'Pfizer',           ratio: 3 },
  'JNJ.BA':   { underlying: 'JNJ',   name: 'Johnson & Johnson',ratio: 8 },
  'MRK.BA':   { underlying: 'MRK',   name: 'Merck',            ratio: 10 },
  'LLY.BA':   { underlying: 'LLY',   name: 'Eli Lilly',        ratio: 100 },
  'UNH.BA':   { underlying: 'UNH',   name: 'UnitedHealth',     ratio: 75 },
  'BA.BA':    { underlying: 'BA',    name: 'Boeing',           ratio: 10 },
  'CAT.BA':   { underlying: 'CAT',   name: 'Caterpillar',      ratio: 10 },
  'GE.BA':    { underlying: 'GE',    name: 'General Electric', ratio: 4 },
  'F.BA':     { underlying: 'F',     name: 'Ford',             ratio: 2 },
  'BABA.BA':  { underlying: 'BABA',  name: 'Alibaba',          ratio: 5 },
  'PBR.BA':   { underlying: 'PBR',   name: 'Petrobras',        ratio: 1 },
  'VALE.BA':  { underlying: 'VALE',  name: 'Vale',             ratio: 1 },
  'MELI.BA':  { underlying: 'MELI',  name: 'MercadoLibre',     ratio: 4 },
  'GLOB.BA':  { underlying: 'GLOB',  name: 'Globant',          ratio: 2 },
  'VIST.BA':  { underlying: 'VIST',  name: 'Vista Energy',     ratio: 6 },
  'TSM.BA':   { underlying: 'TSM',   name: 'TSMC',             ratio: 5 },
  'BRKB.BA':  { underlying: 'BRK-B', name: 'Berkshire Hathaway B', ratio: 72 },
}
