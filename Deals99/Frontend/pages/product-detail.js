import { fetchProduct, fetchProducts } from '../api.js';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function mapProduct(product) {
  const price = Number(product.price || 0);
  const mrp = Number(product.mrp || price);
  return {
    ...product,
    price,
    mrp,
    image: product.images?.find((image) => image.is_primary)?.image || product.images?.[0]?.image || 'favicon.svg',
    categoryLabel: product.category_name || 'General',
  };
}

function renderProduct(product) {
  const item = mapProduct(product);
  const discount = item.mrp > item.price ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;
  const images = (item.images || []).map((image) => image.image).filter(Boolean);
  const gallery = images.length ? images : [item.image];
  const stockLabel = item.stock > 0 ? `${item.stock} available` : 'Currently out of stock';

  return `
    <div class="row g-5 align-items-start">
      <div class="col-lg-6">
        <div class="product-detail-gallery">
          <div class="product-detail-main-image"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" id="productMainImage"></div>
          <div class="product-detail-thumbnails" role="list">
            ${gallery.map((image) => `<button type="button" class="product-thumbnail" data-image="${escapeHtml(image)}"><img src="${escapeHtml(image)}" alt="${escapeHtml(item.name)} thumbnail"></button>`).join('')}
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <p class="eyebrow mb-2">${escapeHtml(item.categoryLabel)}</p>
        <h1 class="product-detail-title">${escapeHtml(item.name)}</h1>
        <div class="product-detail-rating mb-3"><i class="fas fa-star"></i> ${Number(item.average_rating || 0).toFixed(1)} <span>(${item.reviews_count || 0} reviews)</span></div>
        <div class="product-detail-price">${money(item.price)} ${discount ? `<del>${money(item.mrp)}</del><span>${discount}% off</span>` : ''}</div>
        <p class="product-detail-stock ${item.stock > 0 ? 'is-available' : 'is-empty'}"><i class="fas ${item.stock > 0 ? 'fa-check-circle' : 'fa-circle-xmark'}"></i> ${stockLabel}</p>
        <div class="product-detail-description">${escapeHtml(item.description || 'A quality pick from the Deals99 collection.')}</div>
        <div class="product-detail-actions">
          <button type="button" class="btn btn-primary btn-lg" id="detailAddToCart" ${item.stock <= 0 ? 'disabled' : ''}><i class="fas fa-cart-plus me-2"></i>Add to cart</button>
          <a class="btn btn-outline-primary btn-lg" href="products.html"><i class="fas fa-arrow-left me-2"></i>Continue shopping</a>
        </div>
      </div>
    </div>
    <div class="product-detail-meta mt-5">
      <div><span>Category</span><strong>${escapeHtml(item.categoryLabel)}</strong></div>
      <div><span>SKU</span><strong>DL-${item.id}</strong></div>
      <div><span>Availability</span><strong>${escapeHtml(stockLabel)}</strong></div>
    </div>`;
}

function renderRecommendations(products, currentId) {
  const container = document.getElementById('recommendedProducts');
  const rows = (products || []).filter((product) => String(product.id) !== String(currentId)).slice(0, 4);
  if (!rows.length) {
    container.innerHTML = '<div class="col-12 text-muted">No recommendations available yet.</div>';
    return;
  }
  container.innerHTML = rows.map((product) => {
    const item = mapProduct(product);
    return `<div class="col"><a class="recommended-card" href="product-detail.html?id=${encodeURIComponent(item.id)}" target="_blank" rel="noopener"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy"><div><h3>${escapeHtml(item.name)}</h3><strong>${money(item.price)}</strong><span>View details <i class="fas fa-arrow-up-right-from-square"></i></span></div></a></div>`;
  }).join('');
}

async function init() {
  const id = new URLSearchParams(window.location.search).get('id');
  const status = document.getElementById('productDetailStatus');
  const detail = document.getElementById('productDetail');
  if (!id) {
    status.innerHTML = '<p class="text-danger">Product not found.</p><a class="btn btn-primary" href="products.html">Back to products</a>';
    return;
  }

  try {
    const [product, products] = await Promise.all([fetchProduct(id), fetchProducts({ page_size: 8 })]);
    const item = mapProduct(product);
    document.title = `${item.name} | Deals99`;
    detail.innerHTML = renderProduct(item);
    detail.hidden = false;
    status.hidden = true;
    renderRecommendations(products, id);

    detail.querySelectorAll('.product-thumbnail').forEach((thumbnail) => {
      thumbnail.addEventListener('click', () => {
        document.getElementById('productMainImage').src = thumbnail.dataset.image;
      });
    });
    document.getElementById('detailAddToCart')?.addEventListener('click', async () => {
      const cartManager = window.cartManager;
      if (!cartManager) return;
      const added = await cartManager.addItem({ ...item, img: item.image, qty: 1 });
      if (added) window.NotificationManager?.show('Added to cart', 'success');
    });
  } catch (error) {
    console.error('Product detail failed', error);
    status.innerHTML = '<p class="text-danger">Could not load this product.</p><a class="btn btn-primary" href="products.html">Back to products</a>';
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
