class Store {
  constructor() {
    this.state = {
      activeTab: 'dashboard',
      items: [],
      debts: [],
      sales: [],
      summary: null,
      cart: [],
      itemFilter: 'all',
      itemSearch: '',
      debtFilter: 'belum_lunas',
      debtSearch: '',
      historyPeriod: 'today',
      historyDate: ''
    };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Store listener error:', err);
      }
    }
  }

  // --- Cart Management ---
  addToCart(item, qty = 1) {
    const existingIndex = this.state.cart.findIndex(c => c.id === item.id);
    let newCart = [...this.state.cart];

    if (existingIndex >= 0) {
      const current = newCart[existingIndex];
      const newQty = current.qty + qty;
      if (item.stock !== undefined && newQty > item.stock) {
        throw new Error(`Stok tidak mencukupi (tersedia: ${item.stock})`);
      }
      newCart[existingIndex] = { ...current, qty: newQty };
    } else {
      if (item.stock !== undefined && qty > item.stock) {
        throw new Error(`Stok tidak mencukupi (tersedia: ${item.stock})`);
      }
      newCart.push({
        id: item.id,
        name: item.name,
        category: item.category,
        buy_price: item.buy_price || 0,
        sell_price: item.sell_price || 0,
        stock: item.stock,
        unit: item.unit || 'pcs',
        qty
      });
    }

    this.setState({ cart: newCart });
  }

  updateCartQty(id, delta) {
    const existingIndex = this.state.cart.findIndex(c => c.id === id);
    if (existingIndex < 0) return;

    let newCart = [...this.state.cart];
    const current = newCart[existingIndex];
    const newQty = current.qty + delta;

    if (newQty <= 0) {
      newCart.splice(existingIndex, 1);
    } else {
      if (current.stock !== undefined && newQty > current.stock) {
        throw new Error(`Stok "${current.name}" hanya tersisa ${current.stock}`);
      }
      newCart[existingIndex] = { ...current, qty: newQty };
    }

    this.setState({ cart: newCart });
  }

  removeFromCart(id) {
    const newCart = this.state.cart.filter(c => c.id !== id);
    this.setState({ cart: newCart });
  }

  clearCart() {
    this.setState({ cart: [] });
  }

  getCartTotal() {
    return this.state.cart.reduce((sum, item) => sum + (item.sell_price * item.qty), 0);
  }

  getCartItemCount() {
    return this.state.cart.reduce((sum, item) => sum + item.qty, 0);
  }
}

// Global singleton instance for browser
const appStore = new Store();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Store, appStore };
}

if (typeof window !== 'undefined') {
  window.Store = Store;
  window.appStore = appStore;
}
