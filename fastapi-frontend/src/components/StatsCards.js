import React from 'react';

const StatsCards = ({ stats, notifications }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-blue-100 p-4 rounded-xl">
        <h3 className="text-lg font-semibold text-blue-800">Total Items</h3>
        <p className="text-3xl font-bold text-blue-600">{stats.total_items || 0}</p>
      </div>
      <div className="bg-green-100 p-4 rounded-xl">
        <h3 className="text-lg font-semibold text-green-800">In Stock</h3>
        <p className="text-3xl font-bold text-green-600">{stats.in_stock || 0}</p>
      </div>
      <div className="bg-red-100 p-4 rounded-xl">
        <h3 className="text-lg font-semibold text-red-800">Out of Stock</h3>
        <p className="text-3xl font-bold text-red-600">{stats.out_of_stock || 0}</p>
      </div>
      <div className="bg-purple-100 p-4 rounded-xl">
        <h3 className="text-lg font-semibold text-purple-800">Notifications</h3>
        <p className="text-3xl font-bold text-purple-600">{notifications.length}</p>
      </div>
    </div>
  );
};

export default StatsCards;