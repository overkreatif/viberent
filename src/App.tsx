import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./store/auth";
import { FullPageLoader, RequireAuth, RequireRole } from "./routes/guards";
import Login from "./pages/Login";
import { ClientLayout } from "./layouts/ClientLayout";
import { AdminLayout } from "./layouts/AdminLayout";
import Catalog from "./pages/client/Catalog";
import ProductDetail from "./pages/client/ProductDetail";
import Wishlist from "./pages/client/Wishlist";
import MyBookings from "./pages/client/MyBookings";
import Dashboard from "./pages/admin/Dashboard";
import Products from "./pages/admin/Products";
import Blocking from "./pages/admin/Blocking";
import Categories from "./pages/admin/Categories";
import Clients from "./pages/admin/Clients";

/** Catch-all: sends users to the app that matches their role. */
function HomeRedirect() {
  const { user, profile, loading, profileLoading } = useAuth();
  if (loading || profileLoading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={profile?.role === "admin" ? "/admin" : "/"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth />}>
            {/* Client area */}
            <Route element={<RequireRole role="client" />}>
              <Route element={<ClientLayout />}>
                <Route index element={<Catalog />} />
                <Route path="product/:id" element={<ProductDetail />} />
                <Route path="wishlist" element={<Wishlist />} />
                <Route path="my-bookings" element={<MyBookings />} />
              </Route>
            </Route>

            {/* Admin area */}
            <Route element={<RequireRole role="admin" />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="blocking" element={<Blocking />} />
                <Route path="categories" element={<Categories />} />
                <Route path="clients" element={<Clients />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
