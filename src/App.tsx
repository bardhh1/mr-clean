import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout";
import { AdminPage } from "@/pages/admin-page";
import { CartPage } from "@/pages/cart-page";
import { CatalogPage } from "@/pages/catalog-page";
import { CheckoutPage } from "@/pages/checkout-page";
import { HomePage } from "@/pages/home-page";
import { ProductPage } from "@/pages/product-page";
import { QuotePage } from "@/pages/quote-page";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/produkte" element={<CatalogPage />} />
        <Route path="/produkte/:slug" element={<ProductPage />} />
        <Route path="/shporta" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/oferta/peceta" element={<QuotePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
