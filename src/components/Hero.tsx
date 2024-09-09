"use client";

const Hero = () => {
  return (
    <div className="text-center py-10 md:py-20">
      <h1 className="text-6xl md:text-8xl font-bold mb-1 line-height-60">
        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-green-500">
          Hello <br />Gator
        </span>
        {' '}
        <span className="inline-block animate-wiggle">
          🐊
        </span>
      </h1>
      <div className="text-white text-opacity-50">Integrate delegation into your dapp in minutes</div>
      <div className="mt-5 flex flex-col md:flex-row justify-center">
        <a href="https://docs.gator.metamask.io/" target="_blank" className="bg-white text-black rounded-md px-2 py-1 mb-2 md:mb-0 md:mr-2 hover:bg-gray-200">Docs</a>
        <a href="https://github.com/MetaMask/hello-gator" target="_blank" className="bg-white text-black rounded-md px-2 py-1 hover:bg-gray-200">Github</a>
      </div>
    </div>
  );
};

export default Hero;
