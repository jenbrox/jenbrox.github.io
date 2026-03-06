/* ===================================================
   JENTRAX — WISHLIST
   Track items you want to buy, optionally link to goals.
   Depends on: Utils, Store
   =================================================== */

'use strict';

const Wishlist = (() => {

  function addItem(fields) {
    const errors = [];
    if (!fields.name || !fields.name.trim()) errors.push('Item name is required.');
    if (fields.price && !Utils.isPositiveNumber(fields.price)) errors.push('Price must be positive.');
    if (errors.length) return { success: false, errors };

    const now = new Date().toISOString();
    const item = {
      id: Utils.generateId('wish'),
      name: fields.name.trim(),
      price: fields.price ? parseFloat(fields.price) : null,
      url: (fields.url || '').trim(),
      notes: (fields.notes || '').trim(),
      priority: fields.priority || 'medium',
      purchased: false,
      createdAt: now,
      updatedAt: now,
    };

    const all = Store.getWishlist();
    all.push(item);
    Store.saveWishlist(all);
    return { success: true, item };
  }

  function updateItem(id, fields) {
    const all = Store.getWishlist();
    const idx = all.findIndex(i => i.id === id);
    if (idx === -1) return { success: false, errors: ['Item not found.'] };

    all[idx] = {
      ...all[idx],
      name: (fields.name || all[idx].name).trim(),
      price: fields.price ? parseFloat(fields.price) : all[idx].price,
      url: fields.url !== undefined ? (fields.url || '').trim() : all[idx].url,
      notes: fields.notes !== undefined ? (fields.notes || '').trim() : all[idx].notes,
      priority: fields.priority || all[idx].priority,
      updatedAt: new Date().toISOString(),
    };

    Store.saveWishlist(all);
    return { success: true, item: all[idx] };
  }

  function deleteItem(id) {
    Store.saveWishlist(Store.getWishlist().filter(i => i.id !== id));
    return true;
  }

  function togglePurchased(id) {
    const all = Store.getWishlist();
    const item = all.find(i => i.id === id);
    if (!item) return false;
    item.purchased = !item.purchased;
    item.updatedAt = new Date().toISOString();
    Store.saveWishlist(all);
    return item.purchased;
  }

  function getItemById(id) {
    return Store.getWishlist().find(i => i.id === id) || null;
  }

  function getAllItems() {
    return Store.getWishlist().slice().sort((a, b) => {
      if (a.purchased !== b.purchased) return a.purchased ? 1 : -1;
      const pOrder = { high: 0, medium: 1, low: 2 };
      return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1);
    });
  }

  function getTotalCost() {
    return Store.getWishlist()
      .filter(i => !i.purchased && i.price)
      .reduce((sum, i) => sum + i.price, 0);
  }

  return {
    addItem,
    updateItem,
    deleteItem,
    togglePurchased,
    getItemById,
    getAllItems,
    getTotalCost,
  };
})();
