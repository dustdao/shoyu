import {
    TokenFactory,
    NFT721V0,
    ERC721Mock,
    ERC20Mock,
    EnglishAuction,
    DutchAuction,
    FixedPriceSale,
    DesignatedSale,
    ExchangeProxy,
} from "../typechain";

import { sign, convertToHash, domainSeparator, getDigest, getHash, signAsk, signBid } from "./utils/sign-utils";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish, BytesLike, Wallet } from "ethers";
import { expect, assert } from "chai";
import { solidityPack, toUtf8String, defaultAbiCoder } from "ethers/lib/utils";
import { getBlock, mine } from "./utils/blocks";

const { constants } = ethers;
const { AddressZero, HashZero } = constants;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR); // turn off warnings

const setupTest = async () => {
    const signers = await ethers.getSigners();
    const [deployer, protocolVault, operationalVault, alice, bob, carol, royaltyVault] = signers;

    const TokenFactoryContract = await ethers.getContractFactory("TokenFactory");
    const factory = (await TokenFactoryContract.deploy(
        protocolVault.address,
        25,
        operationalVault.address,
        5,
        "https://nft721.sushi.com/",
        "https://nft1155.sushi.com/"
    )) as TokenFactory;

    const NFT721Contract = await ethers.getContractFactory("NFT721V0");
    const nft721 = (await NFT721Contract.deploy()) as NFT721V0;

    const ERC721MockContract = await ethers.getContractFactory("ERC721Mock");
    const erc721Mock = (await ERC721MockContract.deploy()) as ERC721Mock;

    const ERC20MockContract = await ethers.getContractFactory("ERC20Mock");
    const erc20Mock = (await ERC20MockContract.deploy()) as ERC20Mock;

    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = (await EnglishAuction.deploy()) as EnglishAuction;

    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuction = (await DutchAuction.deploy()) as DutchAuction;

    const FixedPriceSale = await ethers.getContractFactory("FixedPriceSale");
    const fixedPriceSale = (await FixedPriceSale.deploy()) as FixedPriceSale;

    const DesignatedSale = await ethers.getContractFactory("DesignatedSale");
    const designatedSale = (await DesignatedSale.deploy()) as DesignatedSale;

    const ExchangeProxy = await ethers.getContractFactory("ExchangeProxy");
    const exchangeProxy = (await ExchangeProxy.deploy()) as ExchangeProxy;

    return {
        deployer,
        protocolVault,
        operationalVault,
        factory,
        nft721,
        alice,
        bob,
        carol,
        royaltyVault,
        erc721Mock,
        erc20Mock,
        englishAuction,
        dutchAuction,
        fixedPriceSale,
        designatedSale,
        exchangeProxy,
    };
};

async function getNFT721(factory: TokenFactory): Promise<NFT721V0> {
    let events: any = await factory.queryFilter(factory.filters.DeployNFT721AndMintBatch(), "latest");
    if (events.length == 0) events = await factory.queryFilter(factory.filters.DeployNFT721AndPark(), "latest");
    const NFT721Contract = await ethers.getContractFactory("NFT721V0");
    return (await NFT721Contract.attach(events[0].args[0])) as NFT721V0;
}

describe("NFT part of NFT721", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("should be that default values are set correctly with batch minting deploy", async () => {
        const { factory, nft721, alice, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 2, 4], royaltyVault.address, 13);
        const nft721_0 = await getNFT721(factory);

        expect(await nft721_0.PERMIT_TYPEHASH()).to.be.equal(
            convertToHash("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)")
        );
        expect(await nft721_0.PERMIT_ALL_TYPEHASH()).to.be.equal(
            convertToHash("Permit(address owner,address spender,uint256 nonce,uint256 deadline)")
        );
        expect(await nft721_0.DOMAIN_SEPARATOR()).to.be.equal(
            await domainSeparator(ethers.provider, "Name", nft721_0.address)
        );
        expect(await nft721_0.factory()).to.be.equal(factory.address);

        async function URI721(nft: NFT721V0, tokenId: number): Promise<string> {
            const baseURI = await factory.baseURI721();
            const addy = nft.address.toLowerCase();
            return toUtf8String(
                solidityPack(
                    ["string", "string", "string", "string", "string"],
                    [baseURI, addy, "/", tokenId.toString(), ".json"]
                )
            );
        }

        expect(await nft721_0.tokenURI(0)).to.be.equal(await URI721(nft721_0, 0));
        expect(await nft721_0.tokenURI(2)).to.be.equal(await URI721(nft721_0, 2));
        expect(await nft721_0.tokenURI(4)).to.be.equal(await URI721(nft721_0, 4));
        await expect(nft721_0.tokenURI(1)).to.be.revertedWith("SHOYU: INVALID_TOKEN_ID");

        expect((await nft721_0.royaltyFeeInfo())[0]).to.be.equal(royaltyVault.address);
        expect((await nft721_0.royaltyInfo(0, 0))[0]).to.be.equal(royaltyVault.address);

        expect((await nft721_0.royaltyFeeInfo())[1]).to.be.equal(13);
        expect((await nft721_0.royaltyInfo(0, 12345))[1]).to.be.equal(Math.floor((12345 * 13) / 1000));

        for (let i = 0; i < 10; i++) {
            assert.isFalse(await nft721_0.parked(i));
        }
    });

    it("should be that default values are set correctly with parking deploy", async () => {
        const { factory, nft721, alice, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 7, royaltyVault.address, 13);
        const nft721_0 = await getNFT721(factory);

        expect(await nft721_0.PERMIT_TYPEHASH()).to.be.equal(
            convertToHash("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)")
        );
        expect(await nft721_0.PERMIT_ALL_TYPEHASH()).to.be.equal(
            convertToHash("Permit(address owner,address spender,uint256 nonce,uint256 deadline)")
        );
        expect(await nft721_0.DOMAIN_SEPARATOR()).to.be.equal(
            await domainSeparator(ethers.provider, "Name", nft721_0.address)
        );
        expect(await nft721_0.factory()).to.be.equal(factory.address);

        async function URI721(nft: NFT721V0, tokenId: number): Promise<string> {
            const baseURI = await factory.baseURI721();
            const addy = nft.address.toLowerCase();
            return toUtf8String(
                solidityPack(
                    ["string", "string", "string", "string", "string"],
                    [baseURI, addy, "/", tokenId.toString(), ".json"]
                )
            );
        }

        expect(await nft721_0.tokenURI(0)).to.be.equal(await URI721(nft721_0, 0));
        expect(await nft721_0.tokenURI(3)).to.be.equal(await URI721(nft721_0, 3));
        expect(await nft721_0.tokenURI(6)).to.be.equal(await URI721(nft721_0, 6));
        await expect(nft721_0.tokenURI(7)).to.be.revertedWith("SHOYU: INVALID_TOKEN_ID");

        expect((await nft721_0.royaltyFeeInfo())[0]).to.be.equal(royaltyVault.address);
        expect((await nft721_0.royaltyInfo(0, 0))[0]).to.be.equal(royaltyVault.address);

        expect((await nft721_0.royaltyFeeInfo())[1]).to.be.equal(13);
        expect((await nft721_0.royaltyInfo(0, 12345))[1]).to.be.equal(Math.floor((12345 * 13) / 1000));

        for (let i = 0; i <= 6; i++) {
            assert.isTrue(await nft721_0.parked(i));
        }
        assert.isFalse(await nft721_0.parked(7));
        assert.isFalse(await nft721_0.parked(8));
        assert.isFalse(await nft721_0.parked(9));
        assert.isFalse(await nft721_0.parked(10));
    });

    it("should be that permit/permitAll fuctions work well", async () => {
        const { factory, nft721, alice, bob, carol, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        const artist = ethers.Wallet.createRandom();

        await factory.deployNFT721AndMintBatch(artist.address, "Name", "Symbol", [0, 1, 2], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        const currentTime = Math.floor(+new Date() / 1000);
        let deadline = currentTime + 100;
        const permitDigest0 = await getDigest(
            ethers.provider,
            "Name",
            nft721_0.address,
            getHash(
                ["bytes32", "address", "uint256", "uint256", "uint256"],
                [await nft721_0.PERMIT_TYPEHASH(), bob.address, 1, 0, deadline]
            )
        );
        const { v: v0, r: r0, s: s0 } = sign(permitDigest0, artist);

        expect(await nft721_0.getApproved(1)).to.be.equal(AddressZero);
        await nft721_0.permit(bob.address, 1, deadline, v0, r0, s0);
        expect(await nft721_0.getApproved(1)).to.be.equal(bob.address);

        const { v: v1, r: r1, s: s1 } = sign(
            await getDigest(
                ethers.provider,
                "Name",
                nft721_0.address,
                getHash(
                    ["bytes32", "address", "uint256", "uint256", "uint256"],
                    [await nft721_0.PERMIT_TYPEHASH(), bob.address, 2, 1, deadline]
                )
            ),
            artist
        );

        const { v: fv0, r: fr0, s: fs0 } = sign(
            await getDigest(
                ethers.provider,
                "Name",
                nft721_0.address,
                getHash(
                    ["bytes32", "address", "uint256", "uint256", "uint256"],
                    [await nft721_0.PERMIT_TYPEHASH(), bob.address, 2, 5, deadline] //invalid nonce
                )
            ),
            artist
        );
        const { v: fv1, r: fr1, s: fs1 } = sign(
            await getDigest(
                ethers.provider,
                "Name",
                nft721_0.address,
                getHash(
                    ["bytes32", "address", "uint256", "uint256", "uint256"],
                    [await nft721_0.PERMIT_TYPEHASH(), bob.address, 2, 1, deadline - 120] //deadline over
                )
            ),
            artist
        );
        const fakeSigner = ethers.Wallet.createRandom();
        const { v: fv2, r: fr2, s: fs2 } = sign(
            await getDigest(
                ethers.provider,
                "Name",
                nft721_0.address,
                getHash(
                    ["bytes32", "address", "uint256", "uint256", "uint256"],
                    [await nft721_0.PERMIT_TYPEHASH(), bob.address, 2, 1, deadline] //fake signer
                )
            ),
            fakeSigner
        );

        await expect(nft721_0.permit(bob.address, 2, deadline, fv0, fr0, fs0)).to.be.revertedWith(
            "SHOYU: UNAUTHORIZED"
        ); //invalid nonce
        await expect(nft721_0.permit(bob.address, 2, deadline - 150, fv1, fr1, fs1)).to.be.revertedWith(
            "SHOYU: EXPIRED"
        ); //deadline over
        await expect(nft721_0.permit(bob.address, 5, deadline, v1, r1, s1)).to.be.revertedWith(
            "SHOYU: INVALID_TOKENID"
        ); //wrong id
        await expect(nft721_0.permit(carol.address, 2, deadline, v1, r1, s1)).to.be.revertedWith("SHOYU: UNAUTHORIZED"); //wrong spender
        await expect(nft721_0.permit(bob.address, 2, deadline, fv2, fr2, fs2)).to.be.revertedWith(
            "SHOYU: UNAUTHORIZED"
        ); //fake signer

        const permitAllDigest0 = await getDigest(
            ethers.provider,
            "Name",
            nft721_0.address,
            getHash(
                ["bytes32", "address", "address", "uint256", "uint256"],
                [await nft721_0.PERMIT_ALL_TYPEHASH(), artist.address, carol.address, 0, deadline]
            )
        );
        const { v: v2, r: r2, s: s2 } = sign(permitAllDigest0, artist);

        expect(await nft721_0.isApprovedForAll(artist.address, carol.address)).to.be.false;

        await expect(nft721_0.permitAll(artist.address, alice.address, deadline, v2, r2, s2)).to.be.revertedWith(
            "SHOYU: UNAUTHORIZED"
        );
        await nft721_0.permitAll(artist.address, carol.address, deadline, v2, r2, s2);

        expect(await nft721_0.isApprovedForAll(artist.address, carol.address)).to.be.true;
    });

    it("should be that owner can only decrease royalty fee", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 7, royaltyVault.address, 20);
        const nft721_0 = await getNFT721(factory);

        await expect(nft721_0.setRoyaltyFee(10)).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(alice).setRoyaltyFee(30)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft721_0.connect(alice).setRoyaltyFee(3);
        expect((await nft721_0.royaltyFeeInfo())[1]).to.be.equal(3);
        await nft721_0.connect(alice).setRoyaltyFee(0);
        expect((await nft721_0.royaltyFeeInfo())[1]).to.be.equal(0);
        await expect(nft721_0.connect(alice).setRoyaltyFee(1)).to.be.revertedWith("SHOYU: INVALID_FEE");

        await factory.deployNFT721AndMintBatch(bob.address, "Name", "Symbol", [9, 11], royaltyVault.address, 0);
        const nft721_1 = await getNFT721(factory);
        expect((await nft721_1.royaltyFeeInfo())[1]).to.be.equal(255);
        await expect(nft721_1.connect(bob).setRoyaltyFee(251)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft721_1.connect(bob).setRoyaltyFee(93);
        expect((await nft721_1.royaltyFeeInfo())[1]).to.be.equal(93);
        await expect(nft721_1.connect(bob).setRoyaltyFee(111)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft721_1.connect(bob).setRoyaltyFee(0);
        expect((await nft721_1.royaltyFeeInfo())[1]).to.be.equal(0);
        await expect(nft721_1.connect(bob).setRoyaltyFee(1)).to.be.revertedWith("SHOYU: INVALID_FEE");
    });

    it("should be that URI functions work well", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        async function URI721(nft: NFT721V0, tokenId: number, _baseURI?: string): Promise<string> {
            if (_baseURI === undefined) {
                const baseURI = await factory.baseURI721();
                const addy = nft.address.toLowerCase();
                return toUtf8String(
                    solidityPack(
                        ["string", "string", "string", "string", "string"],
                        [baseURI, addy, "/", tokenId.toString(), ".json"]
                    )
                );
            } else {
                return toUtf8String(
                    solidityPack(["string", "string", "string"], [_baseURI, tokenId.toString(), ".json"])
                );
            }
        }

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 10, royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await expect(nft721_0.connect(bob).setTokenURI(0, "https://foo.bar/0.json")).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await nft721_0.connect(alice).setTokenURI(0, "https://foo.bar/0.json");
        await nft721_0.connect(alice).setTokenURI(1, "https://foo.bar/1.json");

        expect(await nft721_0.tokenURI(0)).to.be.equal("https://foo.bar/0.json");
        expect(await nft721_0.tokenURI(1)).to.be.equal("https://foo.bar/1.json");

        expect(await nft721_0.tokenURI(2)).to.be.equal(await URI721(nft721_0, 2));
        expect(await nft721_0.tokenURI(4)).to.be.equal(await URI721(nft721_0, 4));
        expect(await nft721_0.tokenURI(7)).to.be.equal(await URI721(nft721_0, 7));
        expect(await nft721_0.tokenURI(2)).to.be.not.equal(await URI721(nft721_0, 2, "https://foo.bar/"));
        expect(await nft721_0.tokenURI(4)).to.be.not.equal(await URI721(nft721_0, 4, "https://foo.bar/"));
        expect(await nft721_0.tokenURI(7)).to.be.not.equal(await URI721(nft721_0, 7, "https://foo.bar/"));

        await expect(nft721_0.connect(bob).setBaseURI("https://foo.bar/")).to.be.revertedWith("SHOYU: FORBIDDEN");
        await nft721_0.connect(alice).setBaseURI("https://foo.bar/");

        expect(await nft721_0.tokenURI(2)).to.be.equal(await URI721(nft721_0, 2, "https://foo.bar/"));
        expect(await nft721_0.tokenURI(4)).to.be.equal(await URI721(nft721_0, 4, "https://foo.bar/"));
        expect(await nft721_0.tokenURI(7)).to.be.equal(await URI721(nft721_0, 7, "https://foo.bar/"));
        expect(await nft721_0.tokenURI(2)).to.be.not.equal(await URI721(nft721_0, 2));
        expect(await nft721_0.tokenURI(4)).to.be.not.equal(await URI721(nft721_0, 4));
        expect(await nft721_0.tokenURI(7)).to.be.not.equal(await URI721(nft721_0, 7));
    });

    it("should be that parkTokenIds func work well", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 50, royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await expect(nft721_0.connect(bob).parkTokenIds(100)).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(alice).parkTokenIds(30)).to.be.revertedWith("SHOYU: INVALID_TO_TOKEN_ID");
        await expect(nft721_0.connect(alice).parkTokenIds(50)).to.be.revertedWith("SHOYU: INVALID_TO_TOKEN_ID");
        await nft721_0.connect(alice).parkTokenIds(51);
        await nft721_0.connect(alice).parkTokenIds(100);
    });

    it("should be that mint/mintBatch functions work well", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(bob.address, "Name", "Symbol", [0, 2, 4], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await expect(nft721_0.mint(alice.address, 1, [])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(bob).mint(alice.address, 0, [])).to.be.revertedWith("SHOYU: ALREADY_MINTED");
        await expect(nft721_0.connect(bob).mint(AddressZero, 1, [])).to.be.revertedWith("SHOYU: INVALID_TO");
        await expect(nft721_0.connect(bob).mint(factory.address, 1, [])).to.be.revertedWith("SHOYU: INVALID_RECEIVER");

        await nft721_0.connect(bob).mint(alice.address, 1, []); //0,1,2,4 are minted

        await expect(nft721_0.mintBatch(alice.address, [3, 5], [])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(bob).mintBatch(alice.address, [3, 4], [])).to.be.revertedWith(
            "SHOYU: ALREADY_MINTED"
        );
        await expect(nft721_0.connect(bob).mintBatch(AddressZero, [3, 5], [])).to.be.revertedWith("SHOYU: INVALID_TO");
        await expect(nft721_0.connect(bob).mintBatch(factory.address, [3, 5], [])).to.be.revertedWith(
            "SHOYU: INVALID_RECEIVER"
        );

        await nft721_0.connect(bob).mint(alice.address, [3, 5], []); //0,1,2,3,4,5 are minted

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 50, royaltyVault.address, 10);
        const nft721_1 = await getNFT721(factory); //nothing is minted. 0-49 are parked

        await expect(nft721_1.mint(bob.address, 1, [])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_1.connect(alice).mint(AddressZero, 1, [])).to.be.revertedWith("SHOYU: INVALID_TO");
        await expect(nft721_1.connect(alice).mint(factory.address, 1, [])).to.be.revertedWith(
            "SHOYU: INVALID_RECEIVER"
        );

        await nft721_1.connect(alice).mint(bob.address, 1, []);
        await nft721_1.connect(alice).mint(bob.address, 50, []); //1,50 are minted. 0-49 are parked

        await expect(nft721_1.mintBatch(bob.address, [3, 5, 7], [])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_1.connect(alice).mintBatch(bob.address, [1, 5, 7], [])).to.be.revertedWith(
            "SHOYU: ALREADY_MINTED"
        );
        await expect(nft721_1.connect(alice).mintBatch(AddressZero, [3, 5, 7], [])).to.be.revertedWith(
            "SHOYU: INVALID_TO"
        );
        await expect(nft721_1.connect(alice).mintBatch(factory.address, [3, 5, 7], [])).to.be.revertedWith(
            "SHOYU: INVALID_RECEIVER"
        );

        await nft721_1.connect(alice).mint(bob.address, [3, 5, 7], []); //1,3,5,7,50 are minted. 0-49 are parked
        await nft721_1.connect(alice).mint(bob.address, [40, 55], []); //1,3,5,7,40,50,55 are minted. 0-49 are parked
        await nft721_1.connect(alice).mint(bob.address, [80, 100], []); //1,3,5,7,40,50,55,80,100 are minted. 0-49 are parked
    });

    it("should be that burn/burnBatch functions work well", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(
            bob.address,
            "Name",
            "Symbol",
            [0, 2, 4, 6, 8, 10],
            royaltyVault.address,
            10
        );
        const nft721_0 = await getNFT721(factory);
        await nft721_0.connect(bob).transferFrom(bob.address, alice.address, 6);
        await nft721_0.connect(bob).transferFrom(bob.address, alice.address, 8);
        await nft721_0.connect(bob).transferFrom(bob.address, alice.address, 10);
        //bob : owner & 0,2,4 _  alice : notOwner & 6,8,10

        await expect(nft721_0.connect(bob).burn(6, 0, HashZero)).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(alice).burn(4, 0, HashZero)).to.be.revertedWith("SHOYU: FORBIDDEN");
        await nft721_0.connect(bob).burn(0, 0, HashZero); //0 is burned

        await expect(nft721_0.connect(bob).burn(0, 0, HashZero)).to.be.revertedWith("SHOYU: FORBIDDEN");

        await nft721_0.connect(alice).burn(6, 0, HashZero); //0,6 is burned

        //bob : owner & 2,4 _  alice : notOwner & 8,10
        await expect(nft721_0.connect(bob).burnBatch([2, 3])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(bob).burnBatch([2, 8])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(bob).burnBatch([3, 8])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(bob).burnBatch([8, 10])).to.be.revertedWith("SHOYU: FORBIDDEN");

        await nft721_0.connect(alice).burnBatch([8, 10]);
        await nft721_0.connect(bob).burnBatch([2]);
    });
});

describe.only("Exchange part of NFT721", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });
    function getWallets() {
        const alice = Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0/3"
        ).connect(ethers.provider);
        const bob = Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0/4"
        ).connect(ethers.provider);
        const carol = Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0/5"
        ).connect(ethers.provider);
        const dan = Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0/7"
        ).connect(ethers.provider);

        return { alice, bob, carol, dan };
    }
    // const {deployer,protocolVault,operationalVault,factory,nft721,royaltyVault,erc721Mock,erc20Mock,englishAuction,dutchAuction,fixedPriceSale,designatedSale,exchangeProxy} = await setupTest();

    it("should be that the cancel function works well", async () => {
        const { factory, nft721, royaltyVault, erc20Mock, englishAuction } = await setupTest();

        const { alice, bob, carol } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);
        await nft721_0.connect(alice).transferFrom(alice.address, bob.address, 1);
        await nft721_0.connect(alice).transferFrom(alice.address, carol.address, 2);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        const currentBlock = await getBlock();
        const deadline0 = currentBlock + 100;
        expect(await nft721_0.ownerOf(0)).to.be.equal(alice.address);
        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            "0x"
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            bob,
            nft721_0.address,
            1,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            "0x"
        );

        await expect(
            nft721_0.connect(bob).cancel({
                signer: alice.address,
                token: nft721_0.address,
                tokenId: 0,
                amount: 1,
                strategy: englishAuction.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: "0x",
                v: askOrder0.sig.v,
                r: askOrder0.sig.r,
                s: askOrder0.sig.s,
            })
        ).to.be.revertedWith("SHOYU: FORBIDDEN");

        await expect(
            nft721_0.connect(alice).cancel({
                signer: bob.address,
                token: nft721_0.address,
                tokenId: 1,
                amount: 1,
                strategy: englishAuction.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: "0x",
                v: askOrder1.sig.v,
                r: askOrder1.sig.r,
                s: askOrder1.sig.s,
            })
        ).to.be.revertedWith("SHOYU: FORBIDDEN");

        expect(
            await nft721_0.connect(alice).cancel({
                signer: alice.address,
                token: nft721_0.address,
                tokenId: 0,
                amount: 1,
                strategy: englishAuction.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: "0x",
                v: askOrder0.sig.v,
                r: askOrder0.sig.r,
                s: askOrder0.sig.s,
            })
        );

        expect(
            await nft721_0.connect(bob).cancel({
                signer: bob.address,
                token: nft721_0.address,
                tokenId: 1,
                amount: 1,
                strategy: englishAuction.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: "0x",
                v: askOrder1.sig.v,
                r: askOrder1.sig.r,
                s: askOrder1.sig.s,
            })
        );

        const askOrder2 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            carol,
            nft721_0.address,
            2,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [50])
        );

        expect((await nft721_0.bestBid(askOrder2.hash))[0]).to.be.equal(AddressZero);
        await nft721_0
            .connect(bob)
            [
                "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
            ](
                {
                    signer: carol.address,
                    token: nft721_0.address,
                    tokenId: 2,
                    amount: 1,
                    strategy: englishAuction.address,
                    currency: erc20Mock.address,
                    recipient: AddressZero,
                    deadline: deadline0,
                    params: defaultAbiCoder.encode(["uint256"], [50]),
                    v: askOrder2.sig.v,
                    r: askOrder2.sig.r,
                    s: askOrder2.sig.s,
                },
                1,
                100,
                AddressZero,
                AddressZero
            );

        expect((await nft721_0.bestBid(askOrder2.hash))[0]).to.be.equal(bob.address);

        await expect(
            nft721_0.connect(carol).cancel({
                signer: carol.address,
                token: nft721_0.address,
                tokenId: 2,
                amount: 1,
                strategy: englishAuction.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: defaultAbiCoder.encode(["uint256"], [50]),
                v: askOrder2.sig.v,
                r: askOrder2.sig.r,
                s: askOrder2.sig.s,
            })
        ).to.be.revertedWith("SHOYU: BID_EXISTS");
    });

    it("should be that the claim function can be called by anyone", async () => {
        const { factory, nft721, royaltyVault, erc20Mock, englishAuction } = await setupTest();

        const { alice, bob, carol, dan } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);
        await nft721_0.connect(alice).transferFrom(alice.address, bob.address, 1);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        const currentBlock = await getBlock();
        const deadline0 = currentBlock + 100;
        expect(await nft721_0.ownerOf(0)).to.be.equal(alice.address);

        await erc20Mock.mint(carol.address, 10000);
        await erc20Mock.mint(dan.address, 10000);
        await erc20Mock.connect(carol).approve(nft721_0.address, 10000);
        await erc20Mock.connect(dan).approve(nft721_0.address, 10000);

        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            bob,
            nft721_0.address,
            1,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            nft721_0.address,
            2,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [50])
        );

        await nft721_0
            .connect(carol)
            [
                "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
            ](
                {
                    signer: alice.address,
                    token: nft721_0.address,
                    tokenId: 0,
                    amount: 1,
                    strategy: englishAuction.address,
                    currency: erc20Mock.address,
                    recipient: AddressZero,
                    deadline: deadline0,
                    params: defaultAbiCoder.encode(["uint256"], [50]),
                    v: askOrder0.sig.v,
                    r: askOrder0.sig.r,
                    s: askOrder0.sig.s,
                },
                1,
                100,
                AddressZero,
                AddressZero
            );
        expect((await nft721_0.bestBid(askOrder0.hash))[0]).to.be.equal(carol.address);
        expect((await nft721_0.bestBid(askOrder0.hash))[2]).to.be.equal(100);

        await nft721_0
            .connect(dan)
            [
                "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
            ](
                {
                    signer: bob.address,
                    token: nft721_0.address,
                    tokenId: 1,
                    amount: 1,
                    strategy: englishAuction.address,
                    currency: erc20Mock.address,
                    recipient: AddressZero,
                    deadline: deadline0,
                    params: defaultAbiCoder.encode(["uint256"], [50]),
                    v: askOrder1.sig.v,
                    r: askOrder1.sig.r,
                    s: askOrder1.sig.s,
                },
                1,
                300,
                AddressZero,
                AddressZero
            );
        expect((await nft721_0.bestBid(askOrder1.hash))[0]).to.be.equal(dan.address);
        expect((await nft721_0.bestBid(askOrder1.hash))[2]).to.be.equal(300);

        await nft721_0
            .connect(dan)
            [
                "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
            ](
                {
                    signer: alice.address,
                    token: nft721_0.address,
                    tokenId: 2,
                    amount: 1,
                    strategy: englishAuction.address,
                    currency: erc20Mock.address,
                    recipient: AddressZero,
                    deadline: deadline0,
                    params: defaultAbiCoder.encode(["uint256"], [50]),
                    v: askOrder2.sig.v,
                    r: askOrder2.sig.r,
                    s: askOrder2.sig.s,
                },
                1,
                500,
                AddressZero,
                AddressZero
            );
        expect((await nft721_0.bestBid(askOrder2.hash))[0]).to.be.equal(dan.address);
        expect((await nft721_0.bestBid(askOrder2.hash))[2]).to.be.equal(500);

        await mine(100);
        assert.isTrue(deadline0 < (await getBlock()));

        //nft0 : seller-Alice / buyer-Carol. Dan can claim.
        expect(
            await nft721_0.connect(dan).claim({
                signer: alice.address,
                token: nft721_0.address,
                tokenId: 0,
                amount: 1,
                strategy: englishAuction.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: defaultAbiCoder.encode(["uint256"], [50]),
                v: askOrder0.sig.v,
                r: askOrder0.sig.r,
                s: askOrder0.sig.s,
            })
        ).to.emit(nft721_0, "Claim");
        expect(await nft721_0.ownerOf(0)).to.be.equal(carol.address);
        expect(await erc20Mock.balanceOf(carol.address)).to.be.equal(9900);

        //nft1 : seller-Bob / buyer-Dan.  Seller Bob can claim.
        expect(
            await nft721_0.connect(bob).claim({
                signer: bob.address,
                token: nft721_0.address,
                tokenId: 1,
                amount: 1,
                strategy: englishAuction.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: defaultAbiCoder.encode(["uint256"], [50]),
                v: askOrder1.sig.v,
                r: askOrder1.sig.r,
                s: askOrder1.sig.s,
            })
        ).to.emit(nft721_0, "Claim");
        expect(await nft721_0.ownerOf(1)).to.be.equal(dan.address);
        expect(await erc20Mock.balanceOf(dan.address)).to.be.equal(9700);

        //nft2 : seller-Alice / buyer-Dan.  Buyer Dan can claim.
        expect(
            await nft721_0.connect(dan).claim({
                signer: alice.address,
                token: nft721_0.address,
                tokenId: 2,
                amount: 1,
                strategy: englishAuction.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: defaultAbiCoder.encode(["uint256"], [50]),
                v: askOrder2.sig.v,
                r: askOrder2.sig.r,
                s: askOrder2.sig.s,
            })
        ).to.emit(nft721_0, "Claim");
        expect(await nft721_0.ownerOf(2)).to.be.equal(dan.address);
        expect(await erc20Mock.balanceOf(dan.address)).to.be.equal(9200);
    });

    it("should be that the claim function will be reverted if BestBid is not exist", async () => {
        const {
            factory,
            nft721,
            royaltyVault,
            erc20Mock,
            englishAuction,
            dutchAuction,
            fixedPriceSale,
            designatedSale,
            exchangeProxy,
        } = await setupTest();

        const { alice } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2, 3], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        await factory.setStrategyWhitelisted(dutchAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        await factory.setStrategyWhitelisted(designatedSale.address, true);

        const currentBlock = await getBlock();
        const deadline0 = currentBlock + 100;
        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            nft721_0.address,
            1,
            1,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            nft721_0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [100])
        );
        const askOrder3 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            nft721_0.address,
            3,
            1,
            designatedSale.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address])
        );

        expect((await nft721_0.bestBid(askOrder0.hash))[0]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder1.hash))[0]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder2.hash))[0]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder3.hash))[0]).to.be.equal(AddressZero);

        await expect(
            nft721_0.claim({
                signer: alice.address,
                token: nft721_0.address,
                tokenId: 3,
                amount: 1,
                strategy: designatedSale.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address]),
                v: askOrder3.sig.v,
                r: askOrder3.sig.r,
                s: askOrder3.sig.s,
            })
        ).to.be.revertedWith("SHOYU: FAILURE");

        await expect(
            nft721_0.claim({
                signer: alice.address,
                token: nft721_0.address,
                tokenId: 2,
                amount: 1,
                strategy: fixedPriceSale.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: defaultAbiCoder.encode(["uint256"], [100]),
                v: askOrder2.sig.v,
                r: askOrder2.sig.r,
                s: askOrder2.sig.s,
            })
        ).to.be.revertedWith("SHOYU: FAILURE");

        await expect(
            nft721_0.claim({
                signer: alice.address,
                token: nft721_0.address,
                tokenId: 1,
                amount: 1,
                strategy: dutchAuction.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock]),
                v: askOrder1.sig.v,
                r: askOrder1.sig.r,
                s: askOrder1.sig.s,
            })
        ).to.be.revertedWith("SHOYU: FAILURE");

        await expect(
            nft721_0.claim({
                signer: alice.address,
                token: nft721_0.address,
                tokenId: 0,
                amount: 1,
                strategy: englishAuction.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: defaultAbiCoder.encode(["uint256"], [50]),
                v: askOrder0.sig.v,
                r: askOrder0.sig.r,
                s: askOrder0.sig.s,
            })
        ).to.be.revertedWith("SHOYU: FAILURE");
        assert.isFalse(deadline0 < (await getBlock()));
        assert.isFalse(await nft721_0.isCancelledOrClaimed(askOrder0.hash));
        expect(await nft721_0.ownerOf(0)).to.be.equal(alice.address);

        await mine(100);
        assert.isTrue(deadline0 < (await getBlock()));
        await expect(
            nft721_0.claim({
                signer: alice.address,
                token: nft721_0.address,
                tokenId: 0,
                amount: 1,
                strategy: englishAuction.address,
                currency: erc20Mock.address,
                recipient: AddressZero,
                deadline: deadline0,
                params: defaultAbiCoder.encode(["uint256"], [50]),
                v: askOrder0.sig.v,
                r: askOrder0.sig.r,
                s: askOrder0.sig.s,
            })
        ).to.emit(nft721_0, "Cancel");
        assert.isTrue(await nft721_0.isCancelledOrClaimed(askOrder0.hash));
        expect(await nft721_0.ownerOf(0)).to.be.equal(alice.address);
    });

    // it("should be ____signing_test___", async () => {
    //     const {
    //         factory,
    //         nft721,
    //         royaltyVault,
    //         erc20Mock,
    //         englishAuction,
    //         dutchAuction,
    //         fixedPriceSale,
    //         designatedSale,
    //         exchangeProxy,
    //     } = await setupTest();

    //     const { alice, bob, carol } = getWallets();

    // await factory.setDeployerWhitelisted(AddressZero, true);
    // await factory.upgradeNFT721(nft721.address);

    // await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2], royaltyVault.address, 10);
    // const nft721_0 = await getNFT721(factory);
    // await nft721_0.connect(alice).transferFrom(alice.address, bob.address, 1);
    // await nft721_0.connect(alice).transferFrom(alice.address, carol.address, 2);

    // await factory.setStrategyWhitelisted(englishAuction.address, true);
    // await factory.setStrategyWhitelisted(dutchAuction.address, true);
    // await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
    // await factory.setStrategyWhitelisted(designatedSale.address, true);

    //     await factory.setStrategyWhitelisted(ea.address, true);
    //     const currentBlock = await getBlock();

    //     expect(await nft721_0.ownerOf(0)).to.be.equal(alice.address);
    //     const askOrder = await signAsk(
    //         ethers.provider,
    //         "Name",
    //         nft721_0.address,
    //         alice,
    //         nft721_0.address,
    //         0,
    //         1,
    //         ea.address,
    //         erc20Mock.address,
    //         AddressZero,
    //         currentBlock,
    //         "0x"
    //     );

    //     await nft721_0.claim({
    //         signer: alice.address,
    //         token: nft721_0.address,
    //         tokenId: 0,
    //         amount: 1,
    //         strategy: ea.address,
    //         currency: erc20Mock.address,
    //         recipient: AddressZero,
    //         deadline: currentBlock,
    //         params: "0x",
    //         v: askOrder.sig.v,
    //         r: askOrder.sig.r,
    //         s: askOrder.sig.s,
    //     });
    // });
});
