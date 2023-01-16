import Head from "next/head";
import styles from "../styles/Home.module.css";
import React, { useEffect, useState } from "react";
import { Web3Storage, File } from "web3.storage";
import Modal from "react-modal";
import { ethers } from "ethers";
import Link from "next/link";
import axios from "axios";

//ABIs
import postABI from "../utils/postABI.json";
import postManagerABI from "../utils/postManagerABI.json";

type Comment = {
  comment_address: string;
  comment_content: string;
};

type Post = {
  post_ID: number;
  post_title: string;
  post_content: string;
  poster_address: string;
  comments: Comment[];
};

type PostDetail = {
  postId: number;
  postTitle: string;
  postContent: string;
  posterWalletAddress: string;
  noOfLikes: number;
  noOfComments: number;
  postSCAddress: string;
  comments: Comment[];
  likedByCurrentUser: boolean;
};

export default function Home() {
  const postManagerContract = "0x51779Df3cF742ff95E6A11d521b19F38D6645Ed3"; //postManager smart contract address

  //variables
  const [token, setToken] = useState<string>(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweGU5N0RDODlFQ0E3NEUxZEVCNDhDYmY4ZjVCODAwRWRCODM1MjlBOEQiLCJpc3MiOiJ3ZWIzLXN0b3JhZ2UiLCJpYXQiOjE2NzI3MTY3MzQ1MDcsIm5hbWUiOiJteVRva2VuIn0.9ycmydenwBvA1a24WGLn4E3kH2C5UYgChY9B4-_ZxJU"
  );

  const [postTitle, setPostTitle] = useState<string>("");
  const [postContent, setPostContent] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [loadedData, setLoadedData] = useState("Loading...");

  const [currentWalletAddress, setCurrentWalletAddress] = useState<string>("");

  const [allPosts, setAllPosts] = useState<PostDetail[]>([]);
  const [noOfPosts, setNoOfPosts] = useState<number>(0);

  const [activePost, setPostToActive] = useState<PostDetail | null>(null);
  const [latestCid, setLatestCid] = useState<string>("");

  const [commentText, setCommentText] = useState<string>("");

  function openModal() {
    setIsLoading(true);
  }

  function closeModal() {
    setIsLoading(false);
  }

  async function getAllPosts() {
    const { ethereum } = window;

    // Check if MetaMask is installed
    if (!ethereum) {
      return "Make sure you have MetaMask Connected!";
    }

    // Get user Metamask Ethereum wallet address
    const accounts = await ethereum.request({
      method: "eth_requestAccounts",
    });
    // Get the first account address
    const walletAddr = accounts[0];
    //set to variable to store current wallet address
    setCurrentWalletAddress(walletAddr);

    if (ethereum) {
      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();

      //create contract instance
      const postManagerContractInstance = new ethers.Contract(
        postManagerContract,
        postManagerABI,
        signer
      );

      //(1) call the getPosts function from the contract to get all Posts contract addresses
      const allPostsAddresses = await postManagerContractInstance.getPosts();
      //(2) call getPostsData function from contract
      const allPosts = await postManagerContractInstance.getPostsData(
        allPostsAddresses
      );
      //(3) set latest cid using react set variable
      setLatestCid(allPosts.postCID);
      // declare new array
      let new_posts = [];

      //iterate and loop through the data retrieve from the blockchain
      for (let i = 0; i < allPosts.posterAddress.length; i++) {
        let posterWalletAddress: string = allPosts.posterAddress[i];
        let noOfLikes: number = allPosts.numberOfLikes[i].toNumber();
        let noOfComments: number = allPosts.numberOfComments[i].toNumber();

        let postSCAddress = allPostsAddresses[i];

        //get postId
        const postid = await postManagerContractInstance.postIDs(postSCAddress);

        if (allPosts.postCID !== 0) {
          //get file data using axios from url
          let config: any = {
            method: "get",
            url: `https://${allPosts.postCID}.ipfs.w3s.link/post.json`,
            headers: {},
          };

          const axiosResponse = await axios(config);
          const postDataObject: Post[] = axiosResponse.data;

          const getCurrentPostTitle = postDataObject.filter(
            (data) => data.post_ID === postid.toNumber()
          )[0].post_title;

          const getCurrentPostContent = postDataObject.filter(
            (data) => data.post_ID === postid.toNumber()
          )[0].post_content;

          //Data of each Post
          let newPost: PostDetail = {
            postTitle: getCurrentPostTitle,
            postContent: getCurrentPostContent,
            postId: postid.toNumber(),
            posterWalletAddress, //user wallet address
            noOfLikes,
            noOfComments,
            postSCAddress, //Post smart contract address
            comments: [],
            likedByCurrentUser: false, //set to false by default
          };

          new_posts.push(newPost);
        }
      }

      setAllPosts(new_posts);
      setNoOfPosts(allPosts.posterAddress.length);
    }
  }

  async function createPost() {
    try {
      //check required fields
      if (!postTitle || !postContent) {
        return alert("Fill all the fields!!");
      }

      setLoadedData("Creating post ...Please wait");
      openModal();

      const storage = new Web3Storage({ token });

      //no post added, no need to get existing file from ipfs
      if (noOfPosts === 0) {
        const postObj: Post[] = [
          {
            post_ID: noOfPosts,
            post_title: postTitle,
            post_content: postContent,
            poster_address: currentWalletAddress,
            comments: [], // no comments when creating a new post, set to empty array
          },
        ];
        const buffer = Buffer.from(JSON.stringify(postObj));

        //(4) call web3.storage API function to store data on IPFS as JSON
        const files = [new File([buffer], "post.json")];
        const cid = await storage.put(files);
        setLatestCid(cid);
        closeModal();

        const { ethereum } = window;

        if (ethereum) {
          //set loading modal to open and loading modal text
          setLoadedData("Creating Post...Please wait");
          openModal();

          const provider = new ethers.providers.Web3Provider(ethereum);
          const signer = provider.getSigner();

          //create post manager contract instance
          const postManagerContractInstance = new ethers.Contract(
            postManagerContract,
            postManagerABI,
            signer
          );

          // (5) call postManager create post function from the contract
          let { hash } = await postManagerContractInstance.createPost(cid, {
            gasLimit: 1200000,
          });
          // (6) wait for transaction to be mined
          await provider.waitForTransaction(hash);
          // (7) display alert message
          alert(`Transaction sent! Hash: ${hash}`);
        }

        //call getAllPosts function to refresh the current list of post
        await getAllPosts();

        //reset fields back to default values
        setPostTitle("");
        setPostContent("");

        //close modal
        closeModal();
      } else {
        //get existing file data from ipfs link
        let config: any = {
          method: "get",
          url: `https://${latestCid}.ipfs.w3s.link/post.json`,
          headers: {},
        };

        const axiosResponse = await axios(config);
        const postDataObject: Post[] = axiosResponse.data;

        let postObj: Post = {
          post_ID: noOfPosts,
          post_title: postTitle,
          post_content: postContent,
          poster_address: currentWalletAddress,
          comments: [],
        };
        postDataObject.push(postObj);

        //store new JSON object in IPFS
        const buffer = Buffer.from(JSON.stringify(postDataObject));

        const newfile = [new File([buffer], "post.json")];
        const cid = await storage.put(newfile);

        setLatestCid(cid);
        closeModal();

        //call smart contract function
        const { ethereum } = window;

        if (ethereum) {
          //set loading modal to open and loading modal text
          setLoadedData("Creating Post...Please wait");
          openModal();

          const provider = new ethers.providers.Web3Provider(ethereum);
          const signer = provider.getSigner();

          //create post manager contract instance
          const postManagerContractInstance = new ethers.Contract(
            postManagerContract,
            postManagerABI,
            signer
          );

          //call create post function from the postManager contract
          let { hash } = await postManagerContractInstance.createPost(cid, {
            gasLimit: 1200000,
          });

          //wait for transaction to be mined
          await provider.waitForTransaction(hash);

          //display alert message
          alert(`Transaction sent! Hash: ${hash}`);
        }
        //call allGroupbuys to refresh the current list
        await getAllPosts();

        //reset fields back to default values
        setPostTitle("");
        setPostContent("");
        //close modal
        closeModal();
      }
    } catch (error) {
      console.log(error);
      closeModal();
      alert(`Error: ${error}`);
      return `${error}`;
    }
  }

  async function postComment(postData: PostDetail) {
    try {
      if (!commentText) {
        return alert("Fill all the fields required!!");
      }

      setLoadedData("Storing comment ...Please wait");
      openModal();

      //call web3.storage API function
      const storage = new Web3Storage({ token });

      let config: any = {
        method: "get",
        url: `https://${latestCid}.ipfs.w3s.link/post.json`,
        headers: {},
      };

      const axiosResponse = await axios(config);
      const postDataObject: Post[] = axiosResponse.data;

      //filter and get the rest of the post data
      let otherPostData: Post[] = postDataObject.filter(
        (data) => data.post_ID !== postData.postId
      );

      //filter out to get current post data to add comment object in
      let getCurrentPostData: Post = postDataObject.filter(
        (data) => data.post_ID === postData.postId
      )[0];

      const userComment = {
        comment_address: currentWalletAddress,
        comment_content: commentText,
      };

      //add new comment into comment array
      getCurrentPostData.comments.push(userComment);

      //add back current post data back into rest of the post data
      otherPostData.push(getCurrentPostData);

      //store new JSON object in IPFS
      const buffer = Buffer.from(JSON.stringify(otherPostData));

      const newfile = [new File([buffer], "post.json")];
      const newCid = await storage.put(newfile);

      setLatestCid(newCid);
      closeModal();

      //call smart contract function
      const { ethereum } = window;

      if (ethereum) {
        //set loading modal to open and loading modal text
        setLoadedData("submitting comment...Please wait");
        openModal();

        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();

        //create contract instance
        const postManagerContractInstance = new ethers.Contract(
          postManagerContract,
          postManagerABI,
          signer
        );

        // (8) call postManager addComment function from the contract
        let { hash } = await postManagerContractInstance.addComment(
          newCid,
          postData.postSCAddress,
          {
            gasLimit: 1200000,
          }
        );
        // (9) wait for transaction to be mined
        await provider.waitForTransaction(hash);
        // (10) display alert message
        alert(`Transaction sent! Hash: ${hash}`);
        //call allGroupbuys to refresh the current list
        await getAllPosts();

        //reset fields back to default values
        setCommentText("");

        //call setActivePost to get updated comments
        await setActivePost(postData, newCid);

        //close modal
        closeModal();
      }
    } catch (error) {
      console.log(error);
      closeModal();
      alert(`Error: ${error}`);
      return `${error}`;
    }
  }

  async function setActivePost(postData: PostDetail, updatedCid: string) {
    try {
      setLoadedData("Getting post details ...Please wait");
      openModal();

      let config: any = {
        method: "get",
        url: `https://${updatedCid}.ipfs.w3s.link/post.json`,
        headers: {},
      };

      const axiosResponse = await axios(config);
      const postDataObject: Post[] = axiosResponse.data;

      const currentPostData: Post = postDataObject.filter(
        (data) => data.post_ID === postData.postId
      )[0];

      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();

        //create contract instance
        const postContractInstance = new ethers.Contract(
          postData.postSCAddress,
          postABI,
          signer
        );

        const postInfo =
          await postContractInstance.getDetailedPostInformation();

        const listOfUserWhoLikedThePost: string[] = postInfo._likeList;

        const hasCurrentUserLiked = listOfUserWhoLikedThePost.some(
          (walletAddr: string) =>
            walletAddr.toLowerCase() === currentWalletAddress
        );

        setPostToActive({
          ...postData,
          comments: currentPostData.comments,
          likedByCurrentUser: hasCurrentUserLiked,
          noOfLikes: listOfUserWhoLikedThePost.length,
        });
      }

      closeModal();
    } catch (error) {
      console.log(error);
      closeModal();
      alert(`Error: ${error}`);
      return `${error}`;
    }
  }

  async function upvotePost(postData: PostDetail) {
    try {
      setLoadedData("Calling Smart Contract ...Please wait");
      openModal();

      if (postData.likedByCurrentUser) {
        alert(
          `You have already liked this post. You can only like a post once.`
        );
        closeModal();
        return "error";
      }

      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();

        // (11) create post contract instance
        const postContractInstance = new ethers.Contract(
          postData.postSCAddress,
          postABI,
          signer
        );
        // (12) call likePost function from the post smart contract
        let { hash } = await postContractInstance.likePost({
          gasLimit: 1200000,
        });
        // (13) wait for transaction to be mined
        await provider.waitForTransaction(hash);
        // (14) display alert message
        alert(`Transaction sent! Hash: ${hash}`);
        //call allGroupbuys to refresh the current list
        await getAllPosts();

        await setActivePost(postData, latestCid);

        closeModal();
      }
    } catch (error) {
      console.log(error);
      closeModal();
      alert(`Error: ${error}`);
      return `${error}`;
    }
  }

  const customStyles = {
    content: {
      top: "50%",
      left: "50%",
      right: "auto",
      bottom: "auto",
      marginRight: "-50%",
      transform: "translate(-50%, -50%)",
      color: "black ",
    },
  };

  //render functions
  function renderAllPosts(allPosts: PostDetail) {
    return (
      <div className={styles.createPostContainer}>
        <p className={styles.paragraphText}>Post ID: {allPosts.postId + 1}</p>
        <h4 className={styles.paragraphText}>
          Post Title: {allPosts.postTitle}
        </h4>
        <p className={styles.paragraphText}>
          Posted by: {allPosts.posterWalletAddress}
        </p>
        <p className={styles.paragraphText}>
          No of Upvotes : {allPosts.noOfLikes}
        </p>
        <p className={styles.paragraphText}>
          No of comments : {allPosts.noOfComments}
        </p>
        {/* <p className={styles.paragraphText}>cid : {allPosts.cid}</p> */}
        <button
          className={styles.viewPostBtn}
          onClick={() => {
            setActivePost(allPosts, latestCid);
          }}
        >
          View Post
        </button>
      </div>
    );
  }

  function getColour(hasLiked: boolean) {
    if (hasLiked) {
      return "orange";
    } else {
      return "black";
    }
  }
  function renderActivePost(postData: PostDetail) {
    return (
      <div className={styles.activePostContainer}>
        <div>
          <div style={{ display: "flex" }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height={48}
              width={48}
              className={styles.upvoteBtn}
              onClick={() => upvotePost(postData)}
              stroke={"black"}
              fill={getColour(postData.likedByCurrentUser)}
            >
              <path d="M11.95 28.85L24 16.75l12.05 12.1z" />
            </svg>
            <h1 className={styles.paragraphText}>{postData.postTitle} </h1>
          </div>
          <div style={{ marginLeft: "17.5px" }}>{postData.noOfLikes}</div>
          <div style={{ display: "flex" }}>
            <p className={styles.detailsText}>Post Smart contract address: </p>
            <p className={styles.hyperlinkText}>
              <Link
                href={`https://goerli.etherscan.io/address/${postData.postSCAddress}`}
                target="_blank"
              >
                {postData.postSCAddress}
              </Link>
            </p>
          </div>
          <p className={styles.detailsText}>
            Posted by: {postData.posterWalletAddress}{" "}
          </p>
          <h4 className={styles.activePostText}>{postData.postContent} </h4>
        </div>
        <div
          style={{
            padding: "5px",
          }}
        >
          <div>
            <h4 className={styles.commentHeading}>
              {(() => {
                if (postData.comments.length === 1) {
                  return <div>{`${postData.comments.length} Comment`}</div>;
                } else {
                  return <div>{`${postData.comments.length} Comments`}</div>;
                }
              })()}
            </h4>

            {postData.comments.map((data) => {
              return (
                <>
                  <div
                    style={{
                      border: "0",
                      borderBottom: "2px",
                      marginLeft: "35px",
                      borderStyle: "solid",
                    }}
                  >
                    <div
                      style={{ margin: "10px" }}
                    >{`Comment by: ${data.comment_address}`}</div>
                    <div
                      style={{ margin: "10px" }}
                    >{`Comment:  ${data.comment_content}`}</div>
                  </div>
                </>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: "20px", marginLeft: "50px" }}>
          <label>Add Comment</label>
          <input
            type="text"
            placeholder="Enter text here"
            onChange={(e) => setCommentText(e.target.value)}
            value={commentText}
            style={{
              padding: "15px",
              textAlign: "center",
              display: "block",
              backgroundColor: "black",
              color: "white",
              width: "400px",
              marginBottom: "10px",
            }}
          />
        </div>

        <div
          style={{
            marginLeft: "50px",
          }}
        >
          <button
            className={styles.postCommentBtn}
            onClick={() => postComment(postData)}
          >
            Submit comment
          </button>

          <button
            className={styles.backBtn}
            onClick={() => setPostToActive(null)}
          >
            Back to home page
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    getAllPosts();
  }, []);

  return (
    <>
      <Head>
        <title>Forum dApp</title>

        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images.png" />
      </Head>

      <div
        style={{
          backgroundColor: "white",
          minWidth: "500px",
          paddingBottom: "10px",
        }}
      >
        <div className={styles.topPanel}>
          <div className={styles.walletAddress}>{`Forum dAPP`}</div>
          <div className={styles.walletAddress}>
            {`Wallet Address: ${currentWalletAddress}`}
          </div>
        </div>

        <Modal
          isOpen={isLoading}
          //onRequestClose={closeModal}
          style={customStyles}
          contentLabel="Example Modal"
        >
          {loadedData}
        </Modal>
        <h2 className={styles.allPosts}>
          {(() => {
            if (activePost == null) {
              return <div>{`All Posts`}</div>;
            } else {
              return <div>{``}</div>;
            }
          })()}
        </h2>

        <div>
          {activePost != null ? (
            renderActivePost(activePost)
          ) : (
            <>
              <div>{allPosts.map((post) => renderAllPosts(post))}</div>
              <div className={styles.createPostContainer}>
                <h2 className={styles.createPostText}>Create New Post </h2>
                <div style={{ margin: "20px" }}>
                  <div style={{ marginTop: "20px" }}>
                    <label>Post Title</label>
                    <input
                      type="text"
                      placeholder="Add Post title here"
                      onChange={(e) => setPostTitle(e.target.value)}
                      value={postTitle}
                      style={{
                        padding: "15px",
                        textAlign: "center",
                        display: "block",
                        backgroundColor: "black",
                        color: "white",
                        width: "400px",
                        marginBottom: "10px",
                      }}
                    />
                  </div>

                  <div style={{ marginTop: "20px" }}>
                    <label>Post Content</label>
                    <input
                      type="text"
                      placeholder="Add Post Content here"
                      onChange={(e) => setPostContent(e.target.value)}
                      value={postContent}
                      style={{
                        padding: "15px",
                        textAlign: "center",
                        display: "block",
                        backgroundColor: "black",
                        color: "white",
                        width: "400px",
                        marginBottom: "10px",
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    className={styles.createPostBtn}
                    onClick={() => createPost()}
                  >
                    Create a new Post
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
