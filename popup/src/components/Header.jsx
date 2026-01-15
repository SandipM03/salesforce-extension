export default function Header({ isSalesforcePage }) {
  return (
    <header className="bg-sf-blue text-white px-4 py-3 flex items-center justify-between shrink-0">
      <h1 className="text-[15px] font-semibold flex items-center gap-2">
        <span>☁️</span>
        Salesforce Extractor
      </h1>
      <span className={`text-[11px] px-2 py-1 rounded-xl ${
        isSalesforcePage ? 'bg-sf-green' : 'bg-white/20'
      }`}>
        {isSalesforcePage ? 'Connected' : 'Not on SF'}
      </span>
    </header>
  );
}
