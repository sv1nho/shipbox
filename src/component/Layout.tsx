import { Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="page-wrapper">
      <header className="navbar">
        <div className="navbar-inner">
          <span className="navbar-title">Shipping Label Generator</span>
        </div>
      </header>
      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}
