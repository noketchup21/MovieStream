import { createContext, useContext, useState } from "react";
import { Toast, ToastContainer } from "react-bootstrap";

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState({
    show: false,
    message: "",
    variant: "success",
    title: "",
  });

  const showToast = ({ message, variant = "success", title }) => {
    setToast({ show: true, message, variant, title });
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <ToastContainer
        position="top-end"
        className="p-3"
        style={{ zIndex: 9999 }}
      >
        <Toast
          bg={toast.variant}
          show={toast.show}
          autohide
          delay={3000}
          onClose={() => setToast((t) => ({ ...t, show: false }))}
          style={{
            minWidth: "300px",
            backdropFilter: "blur(10px)",
            background:
              toast.variant === "success"
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: "16px",
            boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
            animation: "slideIn 0.3s ease-out",
          }}
        >
          <Toast.Header
            closeButton={true}
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              borderTopLeftRadius: "16px",
              borderTopRightRadius: "16px",
              borderBottom: "none",
              padding: "12px 16px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: toast.variant === "success" ? "#10b981" : "#ef4444",
                marginRight: "10px",
                animation: "pulse 2s infinite",
              }}
            />
            <strong
              className="me-auto"
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#1f2937",
              }}
            >
              {toast.title ||
                (toast.variant === "success" ? "Success" : "Error")}
            </strong>
          </Toast.Header>
          <Toast.Body
            className="text-white"
            style={{
              padding: "16px",
              fontSize: "14px",
              lineHeight: "1.5",
              fontWeight: "500",
            }}
          >
            {toast.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .toast-header .btn-close {
          filter: invert(1);
          opacity: 0.6;
        }

        .toast-header .btn-close:hover {
          opacity: 1;
        }
      `}</style>
    </ToastContext.Provider>
  );
};
