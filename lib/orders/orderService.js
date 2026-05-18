import { db } from '@/lib/db'

export async function autoExpireOrders() {

  console.log("AUTO EXPIRE RUNNING")

  try {

    const [orders] = await db.query(`
      SELECT *
      FROM orders
      WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '1 minute'
    `)

    console.log("FOUND ORDERS:", orders.length)
    console.log("ORDERS:", orders)

    for (const order of orders) {

      console.log("CANCELLING:", order.id)

      const [items] = await db.query(
        `
        SELECT *
        FROM order_items
        WHERE order_id = $1
        `,
        [order.id]
      )

      console.log("ITEMS:", items)

      for (const item of items) {

        console.log("RESTORING:", item)

        await db.query(
          `
          UPDATE products
          SET stock = stock + $1
          WHERE id = $2
          `,
          [item.quantity, item.product_id]
        )

      }

      await db.query(
        `
        UPDATE orders
        SET status = 'cancelled'
        WHERE id = $1
        `,
        [order.id]
      )
    }

    return {
      success: true,
      count: orders.length,
    }

  } catch (err) {

    console.error(err)
    throw err
  }
}