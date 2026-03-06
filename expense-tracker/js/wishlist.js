/* ===================================================
   JENTRAK — WISHLIST

   Manages shopping wishlists and gift ideas.
   Track items you want to buy with prices, links, and priority levels.
   Mark items as purchased to keep track of completed purchases.

   Dependencies: Utils, Store
   =================================================== */

'use strict';

const Wishlist = (() => {

  /**
   * Adds an item to the wishlist
   * @param {object} fields - Item data
   * @param {string} fields.name - Item name (required)
   * @param {number} [fields.price] - Price (optional, positive if provided)
   * @param {string} [fields.url] - Product URL (optional)
   * @param {string} [fields.notes] - Additional notes (optional)
   * @param {string} [fields.priority='medium'] - Priority level: 'high', 'medium', 'low'
   * @returns {object} {success: boolean, item: object, errors: string[]}
   */
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

  /**
   * Updates a wishlist item
   * @param {string} id - Item ID
   * @param {object} fields - Fields to update (same as addItem)
   * @returns {object} {success: boolean, item: object, errors: string[]}
   */
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

  /**
   * Deletes a wishlist item
   * @param {string} id - Item ID to delete
   * @returns {boolean} Always true on success
   */
  function deleteItem(id) {
    Store.saveWishlist(Store.getWishlist().filter(i => i.id !== id));
    return true;
  }

  /**
   * Toggles the purchased status of an item
   * Marks an item as bought or not bought
   * @param {string} id - Item ID
   * @returns {boolean|boolean} New purchased state, or false if item not found
   */
  function togglePurchased(id) {
    const all = Store.getWishlist();
    const item = all.find(i => i.id === id);
    if (!item) return false;
    item.purchased = !item.purchased;
    item.updatedAt = new Date().toISOString();
    Store.saveWishlist(all);
    return item.purchased;
  }

  /**
   * Retrieves a single wishlist item by ID
   * @param {string} id - Item ID
   * @returns {object|null} Item object or null if not found
   */
  function getItemById(id) {
    return Store.getWishlist().find(i => i.id === id) || null;
  }

  /**
   * Retrieves all wishlist items, sorted by purchase status then priority
   * Unpurchased items appear first (high priority first), purchased items last
   * @returns {object[]} Sorted array of item objects
   */
  function getAllItems() {
    return Store.getWishlist().slice().sort((a, b) => {
      // Unpurchased items first
      if (a.purchased !== b.purchased) return a.purchased ? 1 : -1;
      // Within each group, sort by priority (high > medium > low)
      const pOrder = { high: 0, medium: 1, low: 2 };
      return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1);
    });
  }

  /**
   * Calculates total cost of unpurchased items that have prices
   * Useful for budget planning
   * @returns {number} Sum of prices for unpurchased items
   */
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
