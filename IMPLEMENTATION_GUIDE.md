# Marketplace Ratings, Reviews & Sold Count Implementation Guide

## ✅ What's Been Added

Your marketplace now has three major new features:

### 1. **Product Sold Count Tracking**
- Automatically tracks how many units of each product have been sold
- Increments when orders are placed
- Displayed on product cards and detail pages
- Used for sorting products by popularity

### 2. **Rating & Review System**
- Users can rate products 1-5 stars
- Users can leave optional comments with their reviews
- Can only review products they've purchased
- Reviews can be updated or deleted
- Automatic average rating calculation
- Reviews sortable by: Recent, Highest Rated, Lowest Rated

### 3. **Advanced Product Sorting**
- **Newest First** - Recently added products
- **Best Rated** - Highest average rating
- **Most Sold** - Most popular by quantity sold
- **Price: Low to High** - Budget-friendly sorting
- **Price: High to Low** - Premium items first

---

## 🗄️ Database Changes

### SQL Migration Required
Run this migration in your Supabase SQL editor:

```sql
-- Add columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;

-- Create product_reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created_at ON product_reviews(created_at DESC);
```

---

## 📁 Files Created/Modified

### ✨ New Files Created:

1. **`/migrations/add_reviews_and_sold_count.sql`**
   - Database migration file with all SQL commands

2. **`/app/api/products/[id]/reviews/route.js`**
   - API endpoints for reviews:
     - `GET` - Fetch reviews for a product
     - `POST` - Submit/update a review
     - `DELETE` - Remove user's review

3. **`/components/products/ReviewsSection.jsx`**
   - React component displaying:
     - Rating stats (average & count)
     - Sold count display
     - Review submission form
     - Reviews list with sorting

### 🔄 Files Modified:

1. **`/app/api/products/route.js`**
   - Added `sortBy` query parameter support
   - Sorting options: `newest`, `best_rated`, `most_sold`, `price_low`, `price_high`
   - Includes `average_rating`, `total_ratings`, `sold_count` in responses

2. **`/app/api/products/[id]/route.js`**
   - Includes rating fields in product detail response

3. **`/app/api/orders/route.js`**
   - Increments `sold_count` when orders are placed

4. **`/components/products/ProductCard.js`**
   - Added visual display of:
     - ⭐ Average rating with star count
     - 📦 Number of items sold
     - Responsive layout with sentiment badge

5. **`/app/(shop)/products/[id]/page.jsx`**
   - Integrated ReviewsSection component
   - Displays full reviews interface on product detail page

6. **`/app/(shop)/page.jsx`**
   - Added sorting dropdown selector
   - Dynamic product fetching based on sort option
   - Includes sort state management

---

## 🚀 How to Use

### For End Users:

1. **View Sold Count & Rating**
   - Look at product cards in the shop to see sold count (📦) and average rating (⭐)
   - Click on a product to see detailed reviews

2. **Leave a Review**
   - Purchase a product
   - Go to the product detail page
   - Scroll to "Customer Reviews" section
   - Select star rating (required)
   - Add optional comment
   - Click "Submit Review"

3. **Update Your Review**
   - Go back to the product you reviewed
   - Fill in a new rating/comment
   - Click "Update Your Review"

4. **Sort Products**
   - Use the dropdown on the shop page:
     - "Best Rated" - See highest-rated products
     - "Most Sold" - See most popular items
     - Other sorting options available

### For Backend:

**API Endpoints Available:**

```
GET  /api/products?sortBy=best_rated
     /api/products?sortBy=most_sold
     /api/products?sortBy=price_low
     /api/products?sortBy=price_high
     
GET  /api/products/[id]/reviews?sortBy=recent
     /api/products/[id]/reviews?sortBy=highest_rated
     /api/products/[id]/reviews?sortBy=lowest_rated

POST /api/products/[id]/reviews
     Body: { rating: 1-5, comment?: string }

DELETE /api/products/[id]/reviews
```

---

## 🎨 UI Components

### ProductCard Updates
- Added rating stars display
- Added sold count badge
- Responsive layout maintained

### ReviewsSection Component
- Rating statistics panel
- Sold count panel
- Review submission form
- Reviews listing with filtering
- Responsive design

---

## ⚙️ Important Notes

1. **Purchase Requirement**
   - Users can only review products they've purchased (verified by checking completed orders)
   - This prevents fake reviews

2. **One Review Per Product Per User**
   - Using UNIQUE constraint on (product_id, user_id)
   - Users can update but not duplicate their review

3. **Automatic Rating Calculation**
   - Average rating updates automatically when reviews are added/deleted
   - Null if no reviews exist

4. **Performance Optimized**
   - Indexes on frequently queried columns
   - Efficient query patterns
   - Ratings calculated server-side

5. **Sold Count Tracking**
   - Increments only on successful order placement
   - Not decremented on refunds (you can customize this)

---

## 🔧 Customization Options

### To modify review requirements:
Edit `/app/api/products/[id]/reviews/route.js` - Look for the purchase verification section

### To change sorting options:
Edit `/app/(shop)/page.jsx` - Modify the select dropdown options

### To customize UI colors:
Edit `/components/products/ReviewsSection.jsx` - Colors use Tailwind classes

---

## ✨ Future Enhancements You Could Add

1. **Review Moderation**
   - Admin approval for reviews
   - Flagging inappropriate reviews

2. **Verified Badge**
   - Show which reviews are from verified buyers

3. **Helpful Votes**
   - Let users vote if reviews are helpful

4. **Review Images**
   - Allow users to upload photos with reviews

5. **Seller Response**
   - Let sellers respond to reviews

---

## 📋 Testing Checklist

- [ ] Database migration applied
- [ ] Can view products with sold count on cards
- [ ] Can see ratings on product cards
- [ ] Can navigate to product detail and see ReviewsSection
- [ ] Can submit a review (after purchase)
- [ ] Can update existing review
- [ ] Reviews display correctly
- [ ] Sorting dropdown works for all options
- [ ] Products sort by rating correctly
- [ ] Products sort by sold count correctly
- [ ] Average rating updates after review
- [ ] Review count increments correctly

---

## 🐛 Troubleshooting

**Issue: "You can only review products you have purchased"**
- Make sure the order status is "completed" in the database
- Check that the product ID in the order matches

**Issue: Sold count not increasing**
- Verify products table has `sold_count` column
- Check that orders are being created successfully

**Issue: Rating not showing**
- Make sure at least one review exists
- Check that the average_rating column is populated

---

All done! Your marketplace now supports ratings, reviews, and sales tracking! 🎉
