import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Layout } from "@/components/layout";

const AdminPage = lazy(() => import("@/pages/admin-page").then((module) => ({ default: module.AdminPage })));
const CartPage = lazy(() => import("@/pages/cart-page").then((module) => ({ default: module.CartPage })));
const CatalogPage = lazy(() => import("@/pages/catalog-page").then((module) => ({ default: module.CatalogPage })));
const CheckoutPage = lazy(() => import("@/pages/checkout-page").then((module) => ({ default: module.CheckoutPage })));
const HomePage = lazy(() => import("@/pages/home-page").then((module) => ({ default: module.HomePage })));
const ProductPage = lazy(() => import("@/pages/product-page").then((module) => ({ default: module.ProductPage })));

export function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/produkte" element={<CatalogPage />} />
          <Route path="/produkte/:slug" element={<ProductPage />} />
          <Route path="/shporta" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function PageLoading() {
  return (
    <div className="page-shell min-h-[55dvh]" role="status" aria-label="Duke ngarkuar faqen">
      <div className="h-64 animate-pulse rounded-lg border bg-muted" />
    </div>
  );
}
