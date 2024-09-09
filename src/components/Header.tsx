"use client";

import examples from "@/app/examples";

const Header = () => {
  function selectExample() {
    return (
      <select
        className="p-1 text-base rounded-lg border border-gray-300 cursor-pointer min-w-48"
        onChange={(event) => {
          const url = event.target.value;
          window.location.href = url;
        }}
      >
        <option>Select example</option>
        <option value="/">Home</option>
        {examples.map((e, i) => {
          return (
            <option value={`/examples/${e.path}`} key={i}>{e.name}</option>
          );
        })}
      </select>
    );
  }

  return (
    <div
      className="w-full border-b border-gray-600"
    >
      <div className="mx-auto w-full md:w-1/2 my-10">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <h1 className="text-4xl font-bold mb-4 md:mb-0">
            <a href="/" className="no-underline text-white">
              Delegation Toolkit
            </a>
          </h1>
          <div className="mt-4 md:mt-0">{selectExample()}</div>
        </div>
      </div>
    </div>
  );
};

export default Header;
