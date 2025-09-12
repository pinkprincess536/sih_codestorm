const CertificateChain = artifacts.require("CertificateChain");

module.exports = function (deployer) {
  deployer.deploy(CertificateChain);
};
