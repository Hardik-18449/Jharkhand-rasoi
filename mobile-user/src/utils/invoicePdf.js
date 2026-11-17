/**
 * Native replacement for the web jsPDF invoice in UserOrderDetails.jsx.
 * Same content/layout (header, platform + restaurant blocks, order + billed-to, items table, totals, footer),
 * rendered via expo-print (HTML → PDF) and handed to the Android share sheet (save / send).
 */
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const rs = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

export async function generateAndShareInvoice({ settings = {}, restaurantName, restaurantLocation, restaurantObj = {}, order = {}, orderIdDisplay, paymentDate, paymentMethod, userName, addressText, items = [], pricing = {} }) {
  const companyName = settings.companyName || "Jharkhand Rasoi";
  const rows = items
    .map((item, i) => {
      const dp = Number(item.price) || 0;
      const op = Math.max(dp, Number(item.originalPrice) || 0);
      const q = item.quantity || item.qty || 1;
      const unit = op > dp ? `${rs(op)} -&gt; ${rs(dp)}` : rs(dp);
      const line = op > dp ? `${rs(op * q)} -&gt; ${rs(dp * q)}` : rs(dp * q);
      const name = item.variantName ? `${item.name || "Item"} (${item.variantName})` : item.name || "Item";
      return `<tr><td class="c">${i + 1}</td><td>${esc(name)}</td><td class="c">${q}</td><td class="r">${unit}</td><td class="r">${line}</td></tr>`;
    })
    .join("");
  const subtotal = Number(pricing.subtotal || pricing.total || 0);
  const tax = Number(pricing.tax || 0);
  const deliveryFee = Number(pricing.deliveryFee || 0);
  const platformFee = Number(pricing.platformFee || 0);
  const discount = (Number(pricing.discount) || 0) + (Number(pricing.originalItemTotal) || 0) - (Number(pricing.subtotal) || 0);
  const total = Number(pricing.total || 0);
  const totals = [
    ["Item Total:", rs(subtotal)],
    ...(tax > 0 ? [["GST (gov. taxes):", rs(tax)]] : []),
    ["Delivery Fee:", deliveryFee > 0 ? rs(deliveryFee) : "Free"],
    ...(platformFee > 0 ? [["Platform Fee:", rs(platformFee)]] : []),
    ...(discount > 0 ? [["Discount:", `- ${rs(discount)}`]] : []),
  ]
    .map(([l, v]) => `<tr><td>${l}</td><td class="r">${v}</td></tr>`)
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    @page { margin: 14mm; } body { font-family: Helvetica, Arial, sans-serif; color:#0f172a; font-size:11px; border:1px solid #e2e8f0; padding:18px; }
    h1 { color:#DC2626; text-align:center; font-size:26px; margin:6px 0 18px; } .logo { position:absolute; top:26px; left:30px; width:70px; height:70px; object-fit:contain; }
    .two { display:flex; gap:24px; } .two > div { flex:1; } .muted { color:#475569; } b { font-size:13px; }
    hr { border:0; border-top:1px solid #e2e8f0; margin:14px 0; }
    table.items { width:100%; border-collapse:collapse; margin-top:18px; } table.items th { background:#DC2626; color:#fff; padding:8px; text-align:left; }
    table.items td { padding:8px; } table.items tr:nth-child(even) td { background:#f1f5f9; } .c { text-align:center; } .r { text-align:right; }
    table.tot { margin-left:auto; margin-top:14px; min-width:45%; color:#475569; } table.tot td { padding:3px 0 3px 18px; }
    .grand td { font-weight:bold; font-size:13px; color:#0f172a; padding-top:8px; } .foot { text-align:center; color:#94a3b8; font-style:italic; font-size:9px; margin-top:40px; }
  </style></head><body>
    ${settings.logo?.url ? `<img class="logo" src="${esc(settings.logo.url)}"/>` : ""}
    <h1>INVOICE</h1>
    <div class="two" style="margin-top:40px">
      <div><b>${esc(companyName)}</b><div class="muted">${esc(settings.address || "")}</div><div class="muted">FSSAI: ${esc(settings.fssai || "N/A")}</div><div class="muted">GSTIN: ${esc(settings.gstin || "N/A")}</div></div>
      <div><b>${esc(restaurantName)}</b><div class="muted">${esc(restaurantLocation || "Address not available")}</div>
        <div class="muted">FSSAI: ${esc(restaurantObj.fssaiNumber || restaurantObj.fssai || order.restaurantFssai || "N/A")}</div>
        <div class="muted">GSTIN: ${esc(restaurantObj.gstNumber || restaurantObj.gstin || order.restaurantGstin || "N/A")}</div></div>
    </div><hr/>
    <div class="two">
      <div><div style="font-weight:bold">Order ID: ${esc(orderIdDisplay || "N/A")}</div><div class="muted">Date &amp; Time: ${esc(paymentDate || "N/A")}</div><div class="muted">Payment: ${esc(paymentMethod)}</div></div>
      <div><div style="font-weight:bold">Billed To:</div><div>${esc(userName || "Customer")}</div><div class="muted">${esc(addressText || "Address not available")}</div></div>
    </div>
    ${items.length ? `<table class="items"><thead><tr><th class="c">S.No</th><th>Item Description</th><th class="c">Qty</th><th class="r">Unit Price</th><th class="r">Total Price</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
    <table class="tot">${totals}<tr class="grand"><td>Grand Total:</td><td class="r">${rs(total)}</td></tr></table>
    <div class="foot">This is a computer generated invoice and does not require a physical signature.</div>
  </body></html>`;
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Invoice_${orderIdDisplay}`, UTI: "com.adobe.pdf" });
  }
  return uri;
}
