import Icon from './Icon';

export default function ErrorState({ message = 'Something went wrong while loading this data.', onRetry }) {
  return (
    <div className="state-block error-state">
      <div className="state-icon" aria-hidden="true">
        <Icon name="alert-triangle" size={28} />
      </div>
      <div className="state-title">Unable to load</div>
      <div className="state-desc">{message}</div>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry} type="button">
          <Icon name="refresh" size={16} /> Try again
        </button>
      )}
    </div>
  );
}