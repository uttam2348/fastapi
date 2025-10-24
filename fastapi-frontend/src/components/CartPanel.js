import React from 'react';

const CartPanel = ({
  isCartOpen,
  setIsCartOpen,
  cart,
  updateCartQty,
  clearCart,
  checkoutCart,
  items,
  addToCart
}) => {
  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-end z-50">
      <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Your Cart</h2>
          <button onClick={() => setIsCartOpen(false)} className="text-gray-500 hover:text-gray-700">×</button>
        </div>
        <div className="mb-4 p-4 border rounded-lg bg-gray-50">
          <h3 className="font-semibold text-lg mb-2">Shipping Address</h3>
          <p className="text-gray-600">123 Main St, Anytown, USA 12345</p>
        </div>
        {(!cart.items || cart.items.length === 0) ? (
          <p className="text-gray-600">Your cart is empty.</p>
        ) : (
          <div className="space-y-4">
            {cart.items.map((ci, idx) => (
              <div key={idx} className="border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{ci.brand}</p>
                  <p className="text-sm text-gray-500">{ci.name}</p>
                  <p className="text-sm text-gray-700">
                    <span className="line-through">${ci.price}</span>
                    <span className="font-bold text-green-600 ml-2">${(ci.price * 0.9).toFixed(2)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateCartQty(ci.brand, Math.max(0, (ci.quantity || 1) - 1))}
                    className="px-2 py-1 bg-gray-200 rounded"
                  >-</button>
                  <input
                    type="number"
                    min="0"
                    value={ci.quantity}
                    onChange={(e) => updateCartQty(ci.brand, Math.max(0, parseInt(e.target.value || '0', 10)))}
                    className="w-16 p-1 border rounded text-center"
                  />
                  <button
                    onClick={() => updateCartQty(ci.brand, (ci.quantity || 1) + 1)}
                    className="px-2 py-1 bg-gray-200 rounded"
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {cart.items && cart.items.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <div className="flex justify-between text-gray-600">
              <p>Subtotal:</p>
              <p>${cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-gray-600">
              <p>Shipping:</p>
              <p>$5.00</p>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <p>Total:</p>
              <p>${(cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0) + 5).toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-lg font-semibold text-green-600">
              <p>Discounted Total:</p>
              <p>${((cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0) * 0.9) + 5).toFixed(2)}</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              You saved ${(cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0) * 0.1).toFixed(2)}!
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={clearCart} className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700">Clear Cart</button>
          <button onClick={checkoutCart} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700">Checkout</button>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold text-lg mb-2">Pairs well with</h3>
          <div className="space-y-2">
            {items.slice(0, 2).map((item, index) => (
              <div key={index} className="border rounded-lg p-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{item.brand}</p>
                  <p className="text-sm text-gray-500">${item.price}</p>
                </div>
                <button onClick={() => addToCart(item.brand, 1)} className="bg-blue-500 text-white px-2 py-1 rounded text-sm">Add</button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold text-lg mb-2">Similar Items</h3>
          <div className="space-y-2">
            {items.slice(2, 3).map((item, index) => (
              <div key={index} className="border rounded-lg p-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{item.brand}</p>
                  <p className="text-sm text-gray-500">${item.price}</p>
                </div>
                <button onClick={() => addToCart(item.brand, 1)} className="bg-blue-500 text-white px-2 py-1 rounded text-sm">Add</button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold text-lg mb-2">Quality and Application Certificates</h3>
          <div className="space-y-2">
            <div className="border rounded-lg p-2 flex items-center justify-between">
              <div className="flex items-center">
                <span className="mr-2">📄</span>
                <p className="text-sm text-gray-600">ISO 9001 Certified</p>
              </div>
              <button className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-sm">View</button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold text-lg mb-2">Terms and Conditions</h3>
          <p className="text-xs text-gray-500">
            By completing your purchase, you agree to our terms and conditions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CartPanel;