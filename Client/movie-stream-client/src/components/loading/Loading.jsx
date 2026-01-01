import "./loading.css";
const Loading = ({ inline = false }) => {
  if (inline) {
    return <span className="spinner spinner-inline" />;
  }
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Loading...</p>
    </div>
  );
};

export default Loading;
