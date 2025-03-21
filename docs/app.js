let db; // IndexedDB 數據庫實例
let currentOrders = [];
let historyOrders = [];
let orderIdCounter = 1;

// 初始化 IndexedDB
function initDB() {
  const request = indexedDB.open('OrderDB', 2); // 版本號升級為 2

  request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains('currentOrders')) {
      db.createObjectStore('currentOrders', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('historyOrders')) {
      db.createObjectStore('historyOrders', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('metadata')) {
      db.createObjectStore('metadata', { keyPath: 'key' });
    }
  };

  request.onsuccess = (event) => {
    db = event.target.result;
    console.log('Database initialized');
    loadFromIndexedDB(); // 加載數據
  };

  request.onerror = (event) => {
    console.error('Error opening database', event.target.error);
  };
}

// 從 IndexedDB 加載數據
function loadFromIndexedDB() {
  const transaction = db.transaction(['currentOrders', 'historyOrders', 'metadata'], 'readonly');
  const currentOrdersStore = transaction.objectStore('currentOrders');
  const historyOrdersStore = transaction.objectStore('historyOrders');
  const metadataStore = transaction.objectStore('metadata');

  currentOrdersStore.getAll().onsuccess = (event) => {
    currentOrders = event.target.result || [];
    loadCurrentOrders();
  };

  historyOrdersStore.getAll().onsuccess = (event) => {
    historyOrders = event.target.result || [];
    loadHistoryOrders();
  };

  metadataStore.get('orderIdCounter').onsuccess = (event) => {
    const metadata = event.target.result;
    if (metadata) {
      orderIdCounter = metadata.value;
    } else {
      orderIdCounter = 1; // 如果沒有保存過，則從 1 開始
    }
  };
}

// 保存數據到 IndexedDB
function saveToIndexedDB(storeName, data) {
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  data.forEach(order => {
    store.put(order);
  });
}

// 保存 orderIdCounter
function saveOrderIdCounter() {
  const transaction = db.transaction('metadata', 'readwrite');
  const metadataStore = transaction.objectStore('metadata');
  metadataStore.put({ key: 'orderIdCounter', value: orderIdCounter });
}

// 綁定事件監聽器
document.querySelectorAll('.increment').forEach(button => {
  button.addEventListener('click', incrementQuantity);
});

document.querySelectorAll('.decrement').forEach(button => {
  button.addEventListener('click', decrementQuantity);
});

// 增加數量
function incrementQuantity(event) {
  const quantityElement = event.target.parentElement.querySelector('.quantity');
  let quantity = parseInt(quantityElement.textContent);
  quantity++;
  quantityElement.textContent = quantity;
  updateTotal();
}

// 減少數量
function decrementQuantity(event) {
  const quantityElement = event.target.parentElement.querySelector('.quantity');
  let quantity = parseInt(quantityElement.textContent);
  if (quantity > 0) {
    quantity--;
    quantityElement.textContent = quantity;
    updateTotal();
  }
}

// 更新總計
function updateTotal() {
  let total = 0;
  let count = 0;

  document.querySelectorAll('.item').forEach(item => {
    const price = parseFloat(item.querySelector('span').textContent.match(/\d+/)[0]);
    const quantity = parseInt(item.querySelector('.quantity').textContent);
    total += price * quantity;
    count += quantity;
  });

  document.getElementById('total').textContent = total;
  document.getElementById('count').textContent = count;
}

// 打開模態框
document.getElementById('openModalButton').addEventListener('click', () => {
  document.getElementById('modal').style.display = 'flex';
});

// 關閉模態框
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// 新增餐點
document.getElementById('addItemButton').addEventListener('click', addItem);

function addItem() {
  const itemName = document.getElementById('itemNameInput').value;
  const itemPrice = document.getElementById('itemPriceInput').value;

  if (itemName && itemPrice) {
    const newItem = document.createElement('div');
    newItem.classList.add('item');
    newItem.innerHTML = `
      <span>${itemName} - $${itemPrice}</span>
      <button class="decrement">-</button>
      <span class="quantity">0</span>
      <button class="increment">+</button>
    `;
    document.querySelector('.menu').appendChild(newItem);

    // 重新綁定事件監聽器
    newItem.querySelector('.increment').addEventListener('click', incrementQuantity);
    newItem.querySelector('.decrement').addEventListener('click', decrementQuantity);

    // 清空輸入框並關閉模態框
    document.getElementById('itemNameInput').value = '';
    document.getElementById('itemPriceInput').value = '';
    document.getElementById('modal').style.display = 'none';
  }
}

// 加入訂單
document.getElementById('addOrder').addEventListener('click', addOrder);

function addOrder() {
  const total = parseFloat(document.getElementById('total').textContent);
  const count = parseInt(document.getElementById('count').textContent);

  if (count > 0) {
    const order = {
      id: orderIdCounter++,
      time: new Date(),
      items: [],
      total: total
    };

    document.querySelectorAll('.item').forEach(item => {
      const quantity = parseInt(item.querySelector('.quantity').textContent);
      if (quantity > 0) {
        const name = item.querySelector('span').textContent.split(' - ')[0];
        const price = parseFloat(item.querySelector('span').textContent.match(/\d+/)[0]);
        order.items.push({ name, quantity, price });
      }
    });

    currentOrders.push(order);
    saveToIndexedDB('currentOrders', currentOrders); // 保存到 IndexedDB
    saveOrderIdCounter(); // 保存 orderIdCounter
    alert('訂單已加入！');
    resetOrder();
  } else {
    alert('請先選擇餐點！');
  }
}

// 加載進行中的單
function loadCurrentOrders() {
  const currentOrdersList = document.getElementById('currentOrdersList');
  currentOrdersList.innerHTML = '';

  currentOrders.forEach(order => {
    const orderElement = document.createElement('div');
    orderElement.classList.add('order');
    orderElement.innerHTML = `
      <div class="order-header">
        <span>訂單編號：${order.id}</span>
        <span>時間：${new Date(order.time).toLocaleTimeString()}</span>
        <button onclick="deleteOrder(${order.id}, 'current')">✕</button>
      </div>
      <div class="order-details">
        ${order.items.map(item => `
          <div class="order-item">
            <span>${item.name}</span>
            <span>數量：${item.quantity} 單價：$${item.price} 小計：$${item.quantity * item.price}</span>
          </div>
        `).join('')}
      </div>
      <div class="order-actions">
        <span>總金額：$${order.total}</span>
        <button onclick="completeOrder(${order.id})">完成</button>
      </div>
    `;
    currentOrdersList.appendChild(orderElement);
  });
}

// 加載歷史訂單
function loadHistoryOrders() {
  const historyOrdersList = document.getElementById('historyOrdersList');
  const historyTotal = document.getElementById('historyTotal');
  const selectedDate = document.getElementById('historyDate').value;

  historyOrdersList.innerHTML = '';
  let total = 0;

  historyOrders.forEach(order => {
    const orderDate = new Date(order.time).toISOString().split('T')[0];
    if (!selectedDate || orderDate === selectedDate) {
      const orderElement = document.createElement('div');
      orderElement.classList.add('order');
      orderElement.innerHTML = `
        <div class="order-header">
          <span>訂單編號：${order.id}</span>
          <span>時間：${new Date(order.time).toLocaleTimeString()}</span>
          <button onclick="deleteOrder(${order.id}, 'history')">✕</button>
        </div>
        <div class="order-details">
          ${order.items.map(item => `
            <div class="order-item">
              <span>${item.name}</span>
              <span>數量：${item.quantity} 單價：$${item.price} 小計：$${item.quantity * item.price}</span>
            </div>
          `).join('')}
        </div>
        <div class="order-actions">
          <span>總金額：$${order.total}</span>
        </div>
      `;
      historyOrdersList.appendChild(orderElement);
      total += order.total;
    }
  });

  historyTotal.textContent = total;
}

// 刪除訂單
function deleteOrder(orderId, type) {
  const storeName = type === 'current' ? 'currentOrders' : 'historyOrders';
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  store.delete(orderId).onsuccess = () => {
    if (type === 'current') {
      currentOrders = currentOrders.filter(order => order.id !== orderId);
    } else {
      historyOrders = historyOrders.filter(order => order.id !== orderId);
    }
    loadCurrentOrders();
    loadHistoryOrders();
  };
}

// 完成訂單
function completeOrder(orderId) {
  const orderIndex = currentOrders.findIndex(order => order.id === orderId);
  if (orderIndex !== -1) {
    const order = currentOrders[orderIndex];
    historyOrders.push(order); // 添加到歷史訂單
    currentOrders.splice(orderIndex, 1); // 從進行中的訂單中移除

    // 保存到 IndexedDB
    const transaction = db.transaction(['currentOrders', 'historyOrders'], 'readwrite');
    const currentOrdersStore = transaction.objectStore('currentOrders');
    const historyOrdersStore = transaction.objectStore('historyOrders');

    currentOrdersStore.delete(orderId); // 從 currentOrders 中刪除
    historyOrdersStore.put(order); // 添加到 historyOrders

    transaction.oncomplete = () => {
      loadCurrentOrders();
      loadHistoryOrders();
    };
  }
}

// 開新單
document.getElementById('newOrderButton').addEventListener('click', newOrder);

function newOrder() {
  if (confirm('確定要開新單嗎？這將清除目前的選擇！')) {
    resetOrder();
  }
}

// 重置訂單
function resetOrder() {
  document.querySelectorAll('.quantity').forEach(quantity => {
    quantity.textContent = '0';
  });
  updateTotal();
}

// 打開進行中的單模態框
document.getElementById('viewCurrentOrders').addEventListener('click', () => {
  document.getElementById('currentOrdersModal').style.display = 'flex';
  loadCurrentOrders();
});

// 打開歷史訂單模態框
document.getElementById('viewHistory').addEventListener('click', () => {
  document.getElementById('historyOrdersModal').style.display = 'flex';
  loadHistoryOrders();
});

// 初始化 IndexedDB
document.addEventListener('DOMContentLoaded', () => {
  initDB();
});